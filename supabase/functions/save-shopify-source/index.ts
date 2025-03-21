
import { corsHeaders } from './utils.ts';
import { validateSourceData } from './validators.ts';
import { saveShopifySource } from './sourceService.ts';
import { extractUserId } from './utils.ts';

// Main request handler
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  
  try {
    console.log('Received request to save-shopify-source');
    
    // Get the user ID from various sources
    const userId = await extractUserId(req);
    
    // Ensure userId is not null or empty
    if (!userId) {
      console.error('Failed to extract a valid user ID');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Unable to determine user ID. Authentication required.',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
    const validation = validateSourceData(sourceData);
    
    if (!validation.isValid) {
      console.error('Validation failed:', validation.message);
      return new Response(
        JSON.stringify({
          success: false,
          message: validation.message,
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
