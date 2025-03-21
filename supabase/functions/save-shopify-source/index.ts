
import { createClient } from 'https://esm.sh/@supabase/supabase-js@latest';
import { v4 as uuidv4 } from 'https://esm.sh/uuid@latest';

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

// Save source data with secure credential handling
async function saveShopifySource(data: any, userId: string) {
  try {
    console.log('Saving Shopify source with data:', { ...data, access_token: '***REDACTED***' });
    
    // Check if this is an update or a new source
    const isUpdate = !!data.id;
    
    // Store sensitive information securely
    // In this implementation, we'll store the access token directly in the database
    // and other credentials in the encrypted metadata
    
    // Prepare metadata with non-sensitive settings
    const metadata = {
      ...data.metadata,
      store_url: data.store_url,
      // We'll encrypt API key and secret separately in a real implementation
      last_updated: new Date().toISOString(),
    };
    
    // Prepare source data to save
    const sourceData = {
      name: data.name,
      description: data.description,
      type: 'shopify' as const,
      store_name: data.store_name,
      api_version: data.api_version,
      access_token: data.access_token, // Will be encrypted by the database trigger
      connection_status: 'disconnected' as const,
      metadata
    };
    
    console.log('Prepared source data for saving:', { ...sourceData, access_token: '***REDACTED***' });
    
    let result;
    
    if (isUpdate) {
      // Update existing source
      console.log(`Updating existing source with ID: ${data.id}`);
      const { data: updateResult, error } = await supabase
        .from('sources')
        .update(sourceData)
        .eq('id', data.id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating source:', error);
        throw error;
      }
      
      console.log('Source updated successfully');
      result = updateResult;
      
      // Log the update
      await logAuditEvent(
        userId,
        'sources',
        data.id,
        'UPDATE',
        'Updated Shopify source credentials',
        { name: data.name }
      );
    } else {
      // Create new source with user ID
      console.log('Creating new source for user:', userId);
      const { data: insertResult, error } = await supabase
        .from('sources')
        .insert({
          ...sourceData,
          user_id: userId,
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating source:', error);
        throw error;
      }
      
      console.log('Source created successfully with ID:', insertResult?.id);
      result = insertResult;
      
      // Log the creation
      await logAuditEvent(
        userId,
        'sources',
        result.id,
        'INSERT',
        'Created new Shopify source',
        { name: data.name }
      );
    }
    
    // Test the connection immediately after saving
    try {
      console.log('Testing connection after save for source ID:', result.id);
      await testConnection(result.id);
    } catch (connError) {
      console.error('Connection test failed, but source was saved:', connError);
      // Don't fail the whole operation if just the test fails
    }
    
    return {
      success: true,
      source: result,
    };
  } catch (error) {
    console.error('Error saving Shopify source:', error);
    throw error;
  }
}

// Test the connection right after saving
async function testConnection(sourceId: string) {
  try {
    console.log(`Testing connection for source ID: ${sourceId}`);
    // Invoke the check-shopify-connection function
    const response = await fetch(
      `${supabaseUrl}/functions/v1/check-shopify-connection`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ sourceId }),
      }
    );
    
    const responseText = await response.text();
    console.log(`Connection test response status: ${response.status}`);
    
    if (!response.ok) {
      console.error('Error testing connection:', responseText);
      return { success: false, message: 'Connection test failed but source was saved' };
    }
    
    try {
      return JSON.parse(responseText);
    } catch (e) {
      console.error('Error parsing connection test response:', e);
      return { success: false, message: 'Invalid connection test response' };
    }
  } catch (error) {
    console.error('Error invoking connection test:', error);
    return { success: false, message: 'Connection test error, but source was saved' };
  }
}

// Log audit events for security tracking
async function logAuditEvent(
  userId: string,
  tableName: string,
  recordId: string,
  action: string,
  message: string,
  metadata: Record<string, any> = {}
) {
  try {
    // Create audit log entry
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        table_name: tableName,
        record_id: recordId,
        action,
        user_id: userId,
        new_data: {
          message,
          timestamp: new Date().toISOString(),
          ...metadata,
        },
      });
    
    if (error) {
      console.error('Error creating audit log:', error);
    }
  } catch (error) {
    console.error('Error in logAuditEvent:', error);
  }
}

// Main request handler
Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  
  try {
    console.log('Received request to save-shopify-source');
    
    // Get the user ID from the JWT token
    const authHeader = req.headers.get('Authorization');
    let userId = '';
    
    if (authHeader) {
      // Extract user ID from the JWT in a real implementation
      try {
        const token = authHeader.replace('Bearer ', '');
        // In a real app, we would decode and verify the JWT to get the user ID
        // For development purposes, we'll get the user ID from the request if not authenticated
        const { data } = await supabase.auth.getUser(token);
        userId = data.user?.id || '';
        console.log('Got user ID from token:', userId);
      } catch (e) {
        console.error('Error getting user ID from token:', e);
      }
    }
    
    // If no user ID from auth, check for user ID in the request body for development
    if (!userId) {
      console.log('No user ID from auth token, looking for fallback user');
      // For demos/dev, let's get the first user from the database
      const { data: firstUser } = await supabase
        .from('sources')
        .select('user_id')
        .limit(1)
        .single();
      
      userId = firstUser?.user_id || '00000000-0000-0000-0000-000000000000';
      console.log('Using fallback user ID:', userId);
    }
    
    // Parse request body
    let sourceData;
    try {
      sourceData = await req.json();
      console.log('Received source data:', { ...sourceData, access_token: '***REDACTED***' });
    } catch (e) {
      console.error('Error parsing request body:', e);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid request body: ' + (e instanceof Error ? e.message : 'Unknown error'),
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate required fields
    const requiredFields = ['name', 'store_url', 'access_token', 'api_version'];
    const missingFields = requiredFields.filter(field => !sourceData[field]);
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return new Response(
        JSON.stringify({
          success: false,
          message: `Missing required fields: ${missingFields.join(', ')}`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Save the source data
    try {
      const result = await saveShopifySource(sourceData, userId);
      
      console.log('Source saved successfully:', { id: result.source?.id });
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Error in save-shopify-source:', error);
      
      return new Response(
        JSON.stringify({
          success: false,
          message: error instanceof Error ? error.message : 'An unknown error occurred',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (outerError) {
    console.error('Unexpected error in save-shopify-source:', outerError);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: outerError instanceof Error ? outerError.message : 'An unexpected error occurred',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
