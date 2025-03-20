
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.5';
import { corsHeaders } from '../_shared/cors.ts';

interface GraphQLRequest {
  query: string;
  variables?: Record<string, any>;
}

interface QueryExecutionParams {
  sourceId: string;
  query: string;
  variables?: Record<string, any>;
}

// Function to execute a GraphQL query against Shopify
async function executeShopifyQuery(params: QueryExecutionParams) {
  const { sourceId, query, variables } = params;
  
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  try {
    // Get source info
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .select('*')
      .eq('id', sourceId)
      .single();
    
    if (sourceError) throw new Error(`Error fetching source: ${sourceError.message}`);
    if (!source) throw new Error('Source not found');
    
    // Ensure source is Shopify and connected
    if (source.type !== 'shopify') throw new Error('Source must be a Shopify store');
    if (source.connection_status !== 'connected') throw new Error('Shopify source is not connected');
    
    // Get the actual access token using the RPC function
    const { data: tokenData, error: tokenError } = await supabase.rpc(
      'decrypt_access_token',
      { encrypted_token: source.access_token, user_uuid: source.user_id }
    );
    
    if (tokenError) throw new Error(`Error decrypting access token: ${tokenError.message}`);
    if (!tokenData) throw new Error('Could not decrypt access token');
    
    const shopDomain = source.store_name || '';
    const accessToken = tokenData;
    const apiVersion = source.api_version || '2024-04';
    
    // Execute the GraphQL query
    const endpoint = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;
    const requestBody: GraphQLRequest = { query, variables };
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify(requestBody)
    });
    
    // Extract rate limit information
    const rateLimitInfo = {
      available: parseInt(response.headers.get('X-Shopify-Shop-Api-Call-Limit')?.split('/')[0] || '0'),
      maximum: parseInt(response.headers.get('X-Shopify-Shop-Api-Call-Limit')?.split('/')[1] || '0'),
      restoreRate: 50, // Shopify typically restores 50 points per second
      requestCost: 1 // Default cost, more complex queries may cost more
    };
    
    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '1');
      return {
        success: false,
        error: 'Rate limit exceeded',
        rateLimitInfo,
        retryAfter
      };
    }
    
    // Handle other error responses
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GraphQL query failed with status ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    // Check for GraphQL errors
    if (data.errors) {
      const errorMessages = data.errors.map((err: any) => err.message).join(', ');
      throw new Error(`GraphQL errors: ${errorMessages}`);
    }
    
    // Return successful response with data and rate limit info
    return {
      success: true,
      data: data.data,
      rateLimitInfo
    };
  } catch (error) {
    console.error('Error executing Shopify GraphQL query:', error);
    throw error;
  }
}

// Main handler for the function
Deno.serve(async (req) => {
  // Handle CORS for preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const params = await req.json() as QueryExecutionParams;
    
    if (!params.sourceId || !params.query) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: sourceId and query are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    const result = await executeShopifyQuery(params);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        details: error instanceof Error ? error.stack : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
