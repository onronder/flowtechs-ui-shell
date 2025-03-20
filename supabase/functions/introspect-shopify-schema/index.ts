
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.5';
import { corsHeaders } from '../_shared/cors.ts';

interface IntrospectionQuery {
  query: string;
  variables?: Record<string, any>;
}

interface IntrospectionParams {
  sourceId: string;
}

// Standard GraphQL introspection query
const INTROSPECTION_QUERY = `
query IntrospectionQuery {
  __schema {
    queryType {
      name
    }
    mutationType {
      name
    }
    subscriptionType {
      name
    }
    types {
      ...FullType
    }
    directives {
      name
      description
      locations
      args {
        ...InputValue
      }
    }
  }
}

fragment FullType on __Type {
  kind
  name
  description
  fields(includeDeprecated: true) {
    name
    description
    args {
      ...InputValue
    }
    type {
      ...TypeRef
    }
    isDeprecated
    deprecationReason
  }
  inputFields {
    ...InputValue
  }
  interfaces {
    ...TypeRef
  }
  enumValues(includeDeprecated: true) {
    name
    description
    isDeprecated
    deprecationReason
  }
  possibleTypes {
    ...TypeRef
  }
}

fragment InputValue on __InputValue {
  name
  description
  type {
    ...TypeRef
  }
  defaultValue
}

fragment TypeRef on __Type {
  kind
  name
  ofType {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    }
  }
}
`;

// Function to introspect the Shopify GraphQL schema
async function introspectShopifySchema(params: IntrospectionParams) {
  const { sourceId } = params;
  
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
    
    // Check if we have a recent cached schema for this source and API version
    const { data: existingSchema, error: cacheError } = await supabase
      .from('api_schemas')
      .select('*')
      .eq('source_id', sourceId)
      .eq('api_version', apiVersion)
      .single();
    
    if (!cacheError && existingSchema && existingSchema.cache_valid_until) {
      const cacheValidUntil = new Date(existingSchema.cache_valid_until);
      if (cacheValidUntil > new Date()) {
        console.log('Using cached schema');
        return {
          success: true,
          schema: existingSchema.schema,
          fromCache: true
        };
      }
    }
    
    // Execute the introspection query
    const endpoint = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;
    const requestBody: IntrospectionQuery = { 
      query: INTROSPECTION_QUERY
    };
    
    console.log(`Fetching schema from ${endpoint}`);
    
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
      throw new Error(`Introspection query failed with status ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    // Check for GraphQL errors
    if (data.errors) {
      const errorMessages = data.errors.map((err: any) => err.message).join(', ');
      throw new Error(`GraphQL errors: ${errorMessages}`);
    }
    
    // Store the schema in the database with a 1-day cache
    const schemaData = data.data;
    const schemaHash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(schemaData))
    ).then(hash => Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, "0"))
      .join(""));
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const { error: insertError } = await supabase
      .from('api_schemas')
      .upsert({
        source_id: sourceId,
        api_version: apiVersion,
        schema: schemaData,
        schema_hash: schemaHash,
        cache_valid_until: tomorrow.toISOString()
      });
    
    if (insertError) {
      console.error('Failed to cache schema:', insertError);
    }
    
    // Return successful response with data and rate limit info
    return {
      success: true,
      schema: schemaData,
      fromCache: false,
      rateLimitInfo
    };
  } catch (error) {
    console.error('Error executing Shopify GraphQL introspection:', error);
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
    const params = await req.json() as IntrospectionParams;
    
    if (!params.sourceId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: sourceId' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    const result = await introspectShopifySchema(params);
    
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
