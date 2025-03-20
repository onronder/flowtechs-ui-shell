
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

// Define Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle OPTIONS requests for CORS
function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  return null;
}

// Custom exponential backoff logic for retries
async function retryWithBackoff(operation: () => Promise<Response>, maxRetries: number): Promise<Response> {
  let retries = 0;
  
  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (retries >= maxRetries) {
        throw error;
      }
      
      // Calculate exponential delay with some randomization
      const delay = Math.min(1000 * 2 ** retries + Math.random() * 1000, 10000);
      
      console.log(`Retry attempt ${retries + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      retries++;
    }
  }
}

// Decrypt and retrieve the source connection details
async function getSourceDetails(sourceId: string) {
  // Get source record
  const { data: source, error: sourceError } = await supabase
    .from('sources')
    .select('*')
    .eq('id', sourceId)
    .eq('type', 'shopify')
    .single();
  
  if (sourceError) {
    throw new Error(`Error fetching source: ${sourceError.message}`);
  }
  
  if (!source) {
    throw new Error('Source not found');
  }
  
  // Decrypt access token using database function
  const { data: tokenData, error: tokenError } = await supabase.rpc(
    'decrypt_access_token',
    { encrypted_token: source.access_token, user_uuid: source.user_id }
  );
  
  if (tokenError) {
    throw new Error(`Error decrypting token: ${tokenError.message}`);
  }
  
  // Get additional credentials from the metadata
  let storeUrl = '';
  let apiKey = '';
  let apiSecret = '';
  
  if (source.metadata) {
    const metadata = source.metadata as Record<string, any>;
    
    if (metadata.credentials) {
      // These would be encrypted credentials
      // In a real implementation, we'd need a secure way to decrypt these
      // For this demo we're using tokenData (access token) more directly
      storeUrl = metadata.store_url || '';
    }
  }
  
  if (!source.store_name) {
    throw new Error('Store name is missing');
  }
  
  // Construct the store URL if we don't have it from metadata
  if (!storeUrl) {
    storeUrl = `https://${source.store_name}.myshopify.com`;
  }
  
  return {
    id: source.id,
    name: source.name,
    store_url: storeUrl,
    store_name: source.store_name,
    access_token: tokenData,
    api_version: source.api_version || '2024-04',
    connection_timeout: (source.metadata as any)?.connection_timeout || 30,
    max_retries: (source.metadata as any)?.max_retries || 3,
    throttle_rate: (source.metadata as any)?.throttle_rate || 2,
    custom_headers: (source.metadata as any)?.custom_headers || {},
  };
}

// Check Shopify connection status
async function checkShopifyConnection(sourceDetails: any) {
  // Prepare the shop API URL
  const shopApiUrl = `${sourceDetails.store_url}/admin/api/${sourceDetails.api_version}/shop.json`;
  
  // Prepare headers with authentication
  const headers = {
    'X-Shopify-Access-Token': sourceDetails.access_token,
    'Content-Type': 'application/json',
    ...sourceDetails.custom_headers,
  };
  
  // Set up timeout
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort();
  }, sourceDetails.connection_timeout * 1000);
  
  try {
    // Make the request with retry handling
    const response = await retryWithBackoff(
      () => fetch(shopApiUrl, {
        method: 'GET',
        headers,
        signal: timeoutController.signal,
      }),
      sourceDetails.max_retries
    );
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    // Extract rate limit information from headers
    const rateLimitData = {
      available: parseInt(response.headers.get('X-Shopify-Shop-Api-Call-Limit')?.split('/')[0] || '0'),
      total: parseInt(response.headers.get('X-Shopify-Shop-Api-Call-Limit')?.split('/')[1] || '40'),
    };
    
    // Handle the response based on status code
    if (response.ok) {
      const shopData = await response.json();
      
      // Log the successful connection
      await logConnectionEvent(
        sourceDetails.id,
        'connection',
        'success',
        `Successfully connected to shop: ${shopData.shop.name}`,
        { rate_limit: rateLimitData }
      );
      
      // Update source record with successful connection status
      await updateSourceStatus(
        sourceDetails.id,
        'connected',
        null,
        { rate_limits: rateLimitData }
      );
      
      return {
        success: true,
        message: `Connected to ${shopData.shop.name}`,
        shop: shopData.shop,
        rate_limits: rateLimitData,
      };
    } else {
      const errorData = await response.text();
      const errorMessage = `Shopify API error (${response.status}): ${errorData}`;
      
      // Log the connection error
      await logConnectionEvent(
        sourceDetails.id,
        'connection',
        'error',
        errorMessage,
        { status_code: response.status, rate_limit: rateLimitData }
      );
      
      // Update source record with error status
      await updateSourceStatus(
        sourceDetails.id,
        'error',
        errorMessage,
        { rate_limits: rateLimitData }
      );
      
      return {
        success: false,
        message: errorMessage,
        rate_limits: rateLimitData,
      };
    }
  } catch (error) {
    // Clear the timeout
    clearTimeout(timeoutId);
    
    const errorMessage = error instanceof Error 
      ? `Connection error: ${error.message}` 
      : 'Unknown connection error';
    
    // Log the error
    await logConnectionEvent(
      sourceDetails.id,
      'connection',
      'error',
      errorMessage,
      { error_type: error instanceof Error ? error.name : 'Unknown' }
    );
    
    // Update source record with error status
    await updateSourceStatus(
      sourceDetails.id,
      'error',
      errorMessage
    );
    
    return {
      success: false,
      message: errorMessage,
    };
  }
}

// Log connection event to the audit_logs table
async function logConnectionEvent(
  sourceId: string,
  eventType: 'connection' | 'auth' | 'error',
  status: 'success' | 'error',
  message: string,
  metadata: Record<string, any> = {}
) {
  try {
    // Get source name for logging
    const { data: source } = await supabase
      .from('sources')
      .select('name')
      .eq('id', sourceId)
      .single();
    
    // Insert connection log
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'connection_logs',
        record_id: sourceId,
        action: `${eventType}:${status}`,
        user_id: '00000000-0000-0000-0000-000000000000', // System user for connection checks
        old_data: null,
        new_data: {
          source_id: sourceId,
          source_name: source?.name || 'Unknown source',
          event_type: eventType,
          status,
          message,
          metadata,
        },
      });
    
    if (error) {
      console.error('Error logging connection event:', error);
    }
  } catch (error) {
    console.error('Error in logConnectionEvent:', error);
  }
}

// Update source connection status
async function updateSourceStatus(
  sourceId: string,
  connectionStatus: 'connected' | 'disconnected' | 'error',
  connectionError: string | null = null,
  metadataUpdates: Record<string, any> = {}
) {
  try {
    // Get current source record
    const { data: currentSource, error: sourceError } = await supabase
      .from('sources')
      .select('metadata')
      .eq('id', sourceId)
      .single();
    
    if (sourceError) {
      console.error('Error fetching source for update:', sourceError);
      return;
    }
    
    // Merge metadata updates with existing metadata
    const updatedMetadata = {
      ...(currentSource?.metadata || {}),
      ...metadataUpdates,
    };
    
    // Update source record
    const { error } = await supabase
      .from('sources')
      .update({
        connection_status: connectionStatus,
        connection_error: connectionError,
        last_connected_at: connectionStatus === 'connected' ? new Date().toISOString() : undefined,
        metadata: updatedMetadata,
      })
      .eq('id', sourceId);
    
    if (error) {
      console.error('Error updating source status:', error);
    }
  } catch (error) {
    console.error('Error in updateSourceStatus:', error);
  }
}

// Main request handler
Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  
  try {
    // Parse request body
    const { sourceId } = await req.json();
    
    if (!sourceId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Source ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get source details
    const sourceDetails = await getSourceDetails(sourceId);
    
    // Check connection
    const result = await checkShopifyConnection(sourceDetails);
    
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in check-shopify-connection:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
