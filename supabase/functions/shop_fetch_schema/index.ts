
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.5';
import { corsHeaders } from '../_shared/cors.ts';

// Standard GraphQL introspection query with optimizations
const INTROSPECTION_QUERY = `
query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
      ...FullType
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
              }
            }
          }
        }
      }
    }
  }
}
`;

interface SchemaRequest {
  sourceId: string;
  forceRefresh?: boolean;
}

interface ShopifyCredentials {
  store_url: string;
  api_key: string;
  api_secret: string;
  access_token: string;
}

// Cache control settings
const DEFAULT_CACHE_TTL_HOURS = 24;
const CONDITIONAL_REFRESH_THRESHOLD_HOURS = 1;

// Circuit breaker settings
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: number | null = null;
  private isOpen = false;
  
  constructor(
    private threshold: number = 3,
    private resetTimeoutMs: number = 30000
  ) {}
  
  public canRequest(): boolean {
    if (!this.isOpen) return true;
    
    // Check if we're past the reset timeout
    if (this.lastFailureTime && (Date.now() - this.lastFailureTime > this.resetTimeoutMs)) {
      // Move to half-open state
      return true;
    }
    
    return false;
  }
  
  public recordSuccess(): void {
    this.failures = 0;
    this.isOpen = false;
  }
  
  public recordFailure(): boolean {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.isOpen = true;
      return true; // Circuit is now open
    }
    
    return false; // Circuit still closed
  }
}

// Utility to generate schema hash for comparison
async function generateSchemaHash(schema: any): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(schema));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convert to hex string
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Utility to detect schema differences
function detectSchemaDifferences(oldSchema: any, newSchema: any): { 
  hasChanges: boolean; 
  addedTypes: string[]; 
  removedTypes: string[]; 
  modifiedTypes: Record<string, string[]> 
} {
  // Extract type maps from schemas
  const oldTypes = new Map(oldSchema.__schema.types.map((t: any) => [t.name, t]));
  const newTypes = new Map(newSchema.__schema.types.map((t: any) => [t.name, t]));
  
  const addedTypes: string[] = [];
  const removedTypes: string[] = [];
  const modifiedTypes: Record<string, string[]> = {};
  
  // Find added and removed types
  for (const [name] of newTypes) {
    if (!oldTypes.has(name)) {
      addedTypes.push(name);
    }
  }
  
  for (const [name] of oldTypes) {
    if (!newTypes.has(name)) {
      removedTypes.push(name);
    }
  }
  
  // Check for modified types (fields added, removed, or changed)
  for (const [name, newType] of newTypes) {
    if (!oldTypes.has(name)) continue;
    
    const oldType = oldTypes.get(name);
    const changes: string[] = [];
    
    // Only check fields for object types
    if (newType.kind === 'OBJECT' && oldType.kind === 'OBJECT') {
      const oldFields = new Map(oldType.fields?.map((f: any) => [f.name, f]) || []);
      const newFields = new Map(newType.fields?.map((f: any) => [f.name, f]) || []);
      
      // Check for added fields
      for (const [fieldName] of newFields) {
        if (!oldFields.has(fieldName)) {
          changes.push(`Added field: ${fieldName}`);
        }
      }
      
      // Check for removed fields
      for (const [fieldName] of oldFields) {
        if (!newFields.has(fieldName)) {
          changes.push(`Removed field: ${fieldName}`);
        }
      }
      
      // Check for field type changes or deprecation status changes
      for (const [fieldName, newField] of newFields) {
        if (!oldFields.has(fieldName)) continue;
        
        const oldField = oldFields.get(fieldName);
        
        // Check for type changes
        if (JSON.stringify(newField.type) !== JSON.stringify(oldField.type)) {
          changes.push(`Changed type of field: ${fieldName}`);
        }
        
        // Check for deprecation changes
        if (newField.isDeprecated !== oldField.isDeprecated) {
          changes.push(`Changed deprecation status of field: ${fieldName}`);
        }
      }
    }
    
    if (changes.length > 0) {
      modifiedTypes[name] = changes;
    }
  }
  
  return {
    hasChanges: addedTypes.length > 0 || removedTypes.length > 0 || Object.keys(modifiedTypes).length > 0,
    addedTypes,
    removedTypes,
    modifiedTypes
  };
}

// Function to fetch and validate Shopify credentials
async function getShopifyCredentials(supabase: any, sourceId: string): Promise<ShopifyCredentials> {
  try {
    // Verify source exists and is connected
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .select('*, user_id')
      .eq('id', sourceId)
      .eq('type', 'shopify')
      .single();
    
    if (sourceError) throw new Error(`Error fetching source: ${sourceError.message}`);
    if (!source) throw new Error('Source not found');
    if (source.connection_status !== 'connected') {
      throw new Error('Shopify source is not connected');
    }
    
    // Get decrypted access token
    const { data: tokenData, error: tokenError } = await supabase.rpc(
      'decrypt_access_token',
      { encrypted_token: source.access_token, user_uuid: source.user_id }
    );
    
    if (tokenError) throw new Error(`Error decrypting token: ${tokenError.message}`);
    if (!tokenData) throw new Error('Could not decrypt access token');
    
    // Get additional credentials from metadata
    const metadata = source.metadata || {};
    const storeUrl = source.store_name || '';
    
    // Log credential access for audit purposes
    await supabase.from('audit_logs').insert({
      table_name: 'credential_access',
      record_id: sourceId,
      action: 'FETCH_SCHEMA',
      user_id: source.user_id,
      new_data: {
        source_name: source.name,
        timestamp: new Date().toISOString(),
      },
    });
    
    return {
      store_url: storeUrl,
      api_key: '', // Shopify access token flow doesn't require these
      api_secret: '',
      access_token: tokenData
    };
  } catch (error) {
    console.error('Error getting Shopify credentials:', error);
    throw error;
  }
}

// Main schema introspection function with caching and validation
async function introspectShopifySchema(request: SchemaRequest) {
  const { sourceId, forceRefresh } = request;
  
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Create a circuit breaker for API calls
  const circuitBreaker = new CircuitBreaker(3, 60000); // 3 failures, 1 minute reset
  
  const operationStart = Date.now();
  const startTime = new Date().toISOString();
  let schemaSource = 'cache';
  
  try {
    // Log the schema fetch operation start
    const { data: logData, error: logError } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'schema_operations',
        record_id: sourceId,
        action: 'FETCH_SCHEMA_START',
        user_id: (await supabase.auth.getUser()).data.user?.id,
        new_data: {
          timestamp: startTime,
          forceRefresh
        },
      })
      .select('id')
      .single();
      
    if (logError) console.error('Error logging operation start:', logError);
    
    const logId = logData?.id;
    
    // Get source info, including API version
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .select('*')
      .eq('id', sourceId)
      .single();
    
    if (sourceError) throw new Error(`Error fetching source: ${sourceError.message}`);
    if (!source) throw new Error('Source not found');
    
    // Ensure source is Shopify
    if (source.type !== 'shopify') throw new Error('Source must be a Shopify store');
    
    const apiVersion = source.api_version || '2024-04';
    
    // Check if we have a valid cached schema we can use
    if (!forceRefresh) {
      const { data: existingSchema, error: cacheError } = await supabase
        .from('api_schemas')
        .select('*')
        .eq('source_id', sourceId)
        .eq('api_version', apiVersion)
        .single();
      
      if (!cacheError && existingSchema && existingSchema.cache_valid_until) {
        const cacheValidUntil = new Date(existingSchema.cache_valid_until);
        
        // Check if cache is still valid
        if (cacheValidUntil > new Date()) {
          console.log('Using cached schema');
          
          // Calculate age of the cache in minutes
          const cacheAgeMinutes = Math.floor((Date.now() - new Date(existingSchema.updated_at).getTime()) / 60000);
          
          // Add log entry for cache hit
          await supabase
            .from('audit_logs')
            .update({
              action: 'FETCH_SCHEMA_COMPLETE',
              old_data: { schema_hash: existingSchema.schema_hash },
              new_data: {
                schema_source: 'cache',
                cache_age_minutes: cacheAgeMinutes,
                execution_time_ms: Date.now() - operationStart,
                timestamp: new Date().toISOString()
              }
            })
            .eq('id', logId);
          
          return {
            success: true,
            schema: existingSchema.schema,
            fromCache: true,
            cacheAge: cacheAgeMinutes,
            schemaHash: existingSchema.schema_hash
          };
        }
      }
    }
    
    schemaSource = 'api';
    
    // If circuit breaker is open, we can't make API requests
    if (!circuitBreaker.canRequest()) {
      throw new Error('Circuit breaker is open - too many API failures recently. Try again later.');
    }
    
    // Get Shopify credentials
    const credentials = await getShopifyCredentials(supabase, sourceId);
    
    // Prepare for API request
    const shopDomain = credentials.store_url || source.store_name || '';
    if (!shopDomain) throw new Error('Missing Shopify store domain');
    
    const endpoint = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;
    const requestBody = { query: INTROSPECTION_QUERY };
    
    console.log(`Fetching schema from ${endpoint}`);
    
    // Request schema from Shopify GraphQL API
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': credentials.access_token,
        // Add unique request ID for request tracking
        'X-Request-ID': crypto.randomUUID()
      },
      body: JSON.stringify(requestBody)
    });
    
    // Extract rate limit information
    const rateLimitInfo = {
      available: parseInt(response.headers.get('X-Shopify-Shop-Api-Call-Limit')?.split('/')[0] || '0'),
      maximum: parseInt(response.headers.get('X-Shopify-Shop-Api-Call-Limit')?.split('/')[1] || '0'),
      restoreRate: 50, // Default restore rate is 50 points per second
      requestCost: 10  // Introspection queries are typically expensive
    };
    
    // Handle rate limiting
    if (response.status === 429) {
      circuitBreaker.recordFailure();
      const retryAfter = parseInt(response.headers.get('Retry-After') || '10');
      
      // Update log entry for rate limit error
      await supabase
        .from('audit_logs')
        .update({
          action: 'FETCH_SCHEMA_ERROR',
          old_data: null,
          new_data: {
            error_type: 'RATE_LIMIT',
            retry_after: retryAfter,
            rate_limit_info: rateLimitInfo,
            execution_time_ms: Date.now() - operationStart,
            timestamp: new Date().toISOString()
          }
        })
        .eq('id', logId);
      
      throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
    }
    
    // Handle other error responses
    if (!response.ok) {
      circuitBreaker.recordFailure();
      const errorText = await response.text();
      
      // Update log entry for API error
      await supabase
        .from('audit_logs')
        .update({
          action: 'FETCH_SCHEMA_ERROR',
          old_data: null,
          new_data: {
            error_type: 'API_ERROR',
            status_code: response.status,
            error_details: errorText,
            execution_time_ms: Date.now() - operationStart,
            timestamp: new Date().toISOString()
          }
        })
        .eq('id', logId);
      
      throw new Error(`Introspection query failed with status ${response.status}: ${errorText}`);
    }
    
    // Parse the JSON response
    const data = await response.json();
    
    // Check for GraphQL errors
    if (data.errors) {
      circuitBreaker.recordFailure();
      const errorMessages = data.errors.map((err: any) => err.message).join(', ');
      
      // Update log entry for GraphQL errors
      await supabase
        .from('audit_logs')
        .update({
          action: 'FETCH_SCHEMA_ERROR',
          old_data: null,
          new_data: {
            error_type: 'GRAPHQL_ERROR',
            graphql_errors: data.errors,
            execution_time_ms: Date.now() - operationStart,
            timestamp: new Date().toISOString()
          }
        })
        .eq('id', logId);
      
      throw new Error(`GraphQL errors: ${errorMessages}`);
    }
    
    // Record success with circuit breaker
    circuitBreaker.recordSuccess();
    
    // Validate schema structure
    const schemaData = data.data;
    if (!schemaData || !schemaData.__schema) {
      throw new Error('Invalid schema format returned from Shopify');
    }
    
    // Generate schema hash for comparison
    const schemaHash = await generateSchemaHash(schemaData);
    
    // Compare with previous schema if exists
    let schemaDifferences = null;
    const { data: previousSchema } = await supabase
      .from('api_schemas')
      .select('schema, schema_hash')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (previousSchema && previousSchema.schema) {
      if (previousSchema.schema_hash !== schemaHash) {
        // Detect differences between schemas
        schemaDifferences = detectSchemaDifferences(previousSchema.schema, schemaData);
        
        // Log schema changes if significant differences found
        if (schemaDifferences.hasChanges) {
          await supabase
            .from('audit_logs')
            .insert({
              table_name: 'schema_changes',
              record_id: sourceId,
              action: 'SCHEMA_UPDATED',
              user_id: source.user_id,
              old_data: { previous_schema_hash: previousSchema.schema_hash },
              new_data: {
                new_schema_hash: schemaHash,
                api_version: apiVersion,
                timestamp: new Date().toISOString(),
                changes: schemaDifferences
              },
            });
        }
      }
    }
    
    // Calculate cache expiration time (default 24 hours)
    const cacheUntil = new Date();
    cacheUntil.setHours(cacheUntil.getHours() + DEFAULT_CACHE_TTL_HOURS);
    
    // Store the schema in the database with cache expiration
    const { error: insertError } = await supabase
      .from('api_schemas')
      .upsert({
        source_id: sourceId,
        api_version: apiVersion,
        schema: schemaData,
        schema_hash: schemaHash,
        cache_valid_until: cacheUntil.toISOString()
      });
    
    if (insertError) {
      console.error('Failed to cache schema:', insertError);
    }
    
    // Update log entry for successful schema fetch
    await supabase
      .from('audit_logs')
      .update({
        action: 'FETCH_SCHEMA_COMPLETE',
        old_data: previousSchema ? { previous_schema_hash: previousSchema.schema_hash } : null,
        new_data: {
          schema_source: 'api',
          schema_hash: schemaHash,
          has_changes: schemaDifferences?.hasChanges || false,
          change_count: schemaDifferences ? 
            (schemaDifferences.addedTypes.length + 
             schemaDifferences.removedTypes.length + 
             Object.keys(schemaDifferences.modifiedTypes).length) : 0,
          rate_limit_info: rateLimitInfo,
          execution_time_ms: Date.now() - operationStart,
          timestamp: new Date().toISOString()
        }
      })
      .eq('id', logId);
    
    // Return successful response with data, hash, and difference info
    return {
      success: true,
      schema: schemaData,
      fromCache: false,
      schemaHash,
      schemaDifferences: schemaDifferences?.hasChanges ? schemaDifferences : null,
      rateLimitInfo
    };
  } catch (error) {
    console.error('Error executing Shopify GraphQL introspection:', error);
    
    // Log the error
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'schema_operations',
        record_id: sourceId,
        action: 'FETCH_SCHEMA_ERROR',
        user_id: (await supabase.auth.getUser()).data.user?.id,
        new_data: {
          error: error instanceof Error ? error.message : String(error),
          error_stack: error instanceof Error ? error.stack : undefined,
          schema_source: schemaSource,
          execution_time_ms: Date.now() - operationStart,
          timestamp: new Date().toISOString()
        },
      });
    
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
    const requestJson = await req.json();
    const sourceId = requestJson.sourceId;
    const forceRefresh = requestJson.forceRefresh || false;
    
    if (!sourceId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameter: sourceId' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Validate authentication token if present
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Authentication required' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Call the schema fetch function with proper error handling
    try {
      const result = await introspectShopifySchema({
        sourceId,
        forceRefresh
      });
      
      return new Response(
        JSON.stringify(result),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } catch (error) {
      const statusCode = error.message?.includes('Rate limit') ? 429 : 
                        error.message?.includes('not found') ? 404 : 
                        error.message?.includes('Authentication') ? 401 : 500;
                        
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error instanceof Error ? error.message : String(error),
          errorCode: statusCode,
          timestamp: new Date().toISOString(),
          requestId: req.headers.get('X-Request-ID') || crypto.randomUUID()
        }),
        { 
          status: statusCode, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store' 
          } 
        }
      );
    }
  } catch (error) {
    // Handle request parsing errors
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Invalid request format',
        details: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
