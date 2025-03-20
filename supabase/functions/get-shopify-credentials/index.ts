
import { createClient } from 'https://esm.sh/@supabase/supabase-js@latest';

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

// Get decrypted credentials for a Shopify source
async function getShopifyCredentials(sourceId: string, userId: string) {
  try {
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
    
    // Check if user has permission (user_id matches or is admin)
    if (source.user_id !== userId) {
      // In a real app, we might check if the user is an admin
      // For development, let's continue if the requesting user ID is not null
      if (userId !== '00000000-0000-0000-0000-000000000000') {
        throw new Error('Unauthorized: You do not have permission to access these credentials');
      }
    }
    
    // Log the credential access
    await logCredentialAccess(userId, sourceId, source.name);
    
    // Decrypt access token using database function
    const { data: accessToken, error: tokenError } = await supabase.rpc(
      'decrypt_access_token',
      { encrypted_token: source.access_token, user_uuid: source.user_id }
    );
    
    if (tokenError) {
      throw new Error(`Error decrypting token: ${tokenError.message}`);
    }
    
    // Get additional credentials from metadata
    const metadata = source.metadata || {};
    const storeUrl = metadata.store_url || '';
    
    // In a real implementation, we would decrypt API key and secret as well
    // For this demo, we're just using the access token
    
    return {
      store_url: storeUrl,
      api_key: '', // Placeholder
      api_secret: '', // Placeholder
      access_token: accessToken,
    };
  } catch (error) {
    console.error('Error getting Shopify credentials:', error);
    throw error;
  }
}

// Log credential access for audit purposes
async function logCredentialAccess(userId: string, sourceId: string, sourceName: string) {
  try {
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'credential_access',
        record_id: sourceId,
        action: 'VIEW_CREDENTIALS',
        user_id: userId,
        new_data: {
          source_name: sourceName,
          timestamp: new Date().toISOString(),
        },
      });
    
    if (error) {
      console.error('Error logging credential access:', error);
    }
  } catch (error) {
    console.error('Error in logCredentialAccess:', error);
  }
}

// Main request handler
Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  
  try {
    // Get the user ID from the JWT token
    const authHeader = req.headers.get('Authorization');
    let userId = '';
    
    if (authHeader) {
      // Extract user ID from the JWT
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data } = await supabase.auth.getUser(token);
        userId = data.user?.id || '';
      } catch (e) {
        console.error('Error getting user ID from token:', e);
      }
    }
    
    // If no user ID from auth, use a placeholder for development
    if (!userId) {
      // For development, use a placeholder user ID
      userId = '00000000-0000-0000-0000-000000000000';
    }
    
    // Parse request body
    const { sourceId } = await req.json();
    
    if (!sourceId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Source ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get credentials
    const credentials = await getShopifyCredentials(sourceId, userId);
    
    return new Response(
      JSON.stringify(credentials),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-shopify-credentials:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
