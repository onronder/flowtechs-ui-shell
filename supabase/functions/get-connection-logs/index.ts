
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

// Get connection logs from the audit_logs table
async function getConnectionLogs(userId: string, limit: number = 50) {
  try {
    // Get connection logs from audit_logs where the new_data contains connection-related events
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('table_name', 'connection_logs')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw new Error(`Error fetching connection logs: ${error.message}`);
    }
    
    // Transform the data to the expected format
    const logs = data.map(log => ({
      id: log.id,
      source_id: log.record_id,
      source_name: log.new_data?.source_name || 'Unknown',
      event_type: log.new_data?.event_type || 'unknown',
      status: log.new_data?.status || 'unknown',
      message: log.new_data?.message || '',
      metadata: log.new_data?.metadata || {},
      created_at: log.created_at,
    }));
    
    return logs;
  } catch (error) {
    console.error('Error getting connection logs:', error);
    throw error;
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
    
    // Parse request parameters
    const params = await req.json();
    const limit = params.limit || 50;
    
    // Get connection logs
    const logs = await getConnectionLogs(userId, limit);
    
    return new Response(
      JSON.stringify(logs),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-connection-logs:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
