
import { createClient } from 'https://esm.sh/@supabase/supabase-js@latest';

// Define Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Initialize Supabase client
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS headers for all responses
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle OPTIONS requests for CORS
export function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  return null;
}

// Test the connection right after saving
export async function testConnection(sourceId: string) {
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
export async function logAuditEvent(
  userId: string,
  tableName: string,
  recordId: string,
  action: string,
  message: string,
  metadata: Record<string, any> = {}
) {
  try {
    // Skip audit logging if no user ID is provided
    if (!userId) {
      console.warn('Skipping audit log creation: No user ID provided');
      return;
    }
    
    console.log(`Creating audit log: ${action} on ${tableName} for user ${userId}`);
    
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
    } else {
      console.log('Audit log created successfully');
    }
  } catch (error) {
    console.error('Error in logAuditEvent:', error);
  }
}

// Extract and validate the user ID from various sources
export async function extractUserId(req: Request): Promise<string> {
  // Get the user ID from the JWT token
  const authHeader = req.headers.get('Authorization');
  let userId = '';
  
  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const { data } = await supabase.auth.getUser(token);
      userId = data.user?.id || '';
      console.log('Got user ID from token:', userId);
    } catch (e) {
      console.error('Error getting user ID from token:', e);
    }
  }
  
  // If no user ID from auth, check for user ID in the request body
  if (!userId) {
    try {
      // Parse the request to check if user_id is in the body
      const clonedReq = req.clone();
      const body = await clonedReq.json();
      
      // Use user_id from request body if available
      if (body && body.user_id) {
        userId = body.user_id;
        console.log('Using user ID from request body:', userId);
      } else {
        console.log('No user ID from auth token or request body, looking for fallback user');
        
        // For demos/dev, let's get the first user from the database
        const { data: firstUser } = await supabase
          .from('sources')
          .select('user_id')
          .limit(1)
          .single();
        
        userId = firstUser?.user_id || '';
        
        if (!userId) {
          // If still no userId, use a hardcoded ID for development only
          userId = '00000000-0000-0000-0000-000000000000';
          console.log('Using hardcoded user ID as last resort:', userId);
        } else {
          console.log('Using fallback user ID from database:', userId);
        }
      }
    } catch (e) {
      console.error('Error extracting user_id from request:', e);
      
      // Last resort fallback
      userId = '00000000-0000-0000-0000-000000000000';
      console.log('Using hardcoded user ID after error:', userId);
    }
  }
  
  return userId;
}
