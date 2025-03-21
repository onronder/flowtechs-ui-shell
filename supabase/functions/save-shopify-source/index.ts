
import { v4 as uuidv4 } from 'https://esm.sh/uuid@latest';
import { 
  supabase, 
  corsHeaders, 
  handleCors, 
  testConnection, 
  logAuditEvent, 
  extractUserId 
} from './utils.ts';

// Save source data with secure credential handling
async function saveShopifySource(data: any, userId: string) {
  try {
    console.log('Saving Shopify source with data:', { ...data, access_token: '***REDACTED***' });
    
    // Check if this is an update or a new source
    const isUpdate = !!data.id;
    
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
      
      // Only log the audit event if userId is provided
      if (userId) {
        await logAuditEvent(
          userId,
          'sources',
          data.id,
          'UPDATE',
          'Updated Shopify source credentials',
          { name: data.name }
        );
      } else {
        console.warn('No user ID provided for audit logging during update');
      }
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
      
      // Only log the audit event if userId is provided
      if (userId) {
        await logAuditEvent(
          userId,
          'sources',
          result.id,
          'INSERT',
          'Created new Shopify source',
          { name: data.name }
        );
      } else {
        console.warn('No user ID provided for audit logging during insert');
      }
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

// Main request handler
Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  
  try {
    console.log('Received request to save-shopify-source');
    
    // Get the user ID from various sources
    const userId = await extractUserId(req);
    
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
