
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.5';
import { corsHeaders } from '../_shared/cors.ts';

interface SchemaFetchParams {
  sourceId: string;
  apiVersion?: string;
  forceFresh?: boolean;
  validateChanges?: boolean;
}

interface SchemaResponse {
  success: boolean;
  schema?: any;
  error?: string;
  apiVersion: string;
  cached: boolean;
  lastUpdated: string;
  hash?: string;
  diffs?: any[];
  metrics?: {
    executionTimeMs: number;
    schemaSize: number;
    requestId: string;
    statusCode: number;
    rateLimitInfo?: {
      available: number;
      maximum: number;
      restoreRate: number;
      requestCost: number;
    };
  };
}

function calculateSchemaHash(schema: any): string {
  const stringified = JSON.stringify(schema);
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < stringified.length; i++) {
    const char = stringified.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

function detectSchemaDifferences(oldSchema: any, newSchema: any, oldVersion: string, newVersion: string): any {
  if (!oldSchema || !newSchema) {
    return null;
  }

  const newTypes: string[] = [];
  const removedTypes: string[] = [];
  const changedTypes: any[] = [];

  // Get all type names from both schemas
  const oldTypeNames = new Set(oldSchema.__schema.types.map((t: any) => t.name));
  const newTypeNames = new Set(newSchema.__schema.types.map((t: any) => t.name));

  // Find new types
  for (const typeName of newTypeNames) {
    if (!oldTypeNames.has(typeName)) {
      newTypes.push(typeName);
    }
  }

  // Find removed types
  for (const typeName of oldTypeNames) {
    if (!newTypeNames.has(typeName)) {
      removedTypes.push(typeName);
    }
  }

  // Find changed types
  for (const typeName of newTypeNames) {
    if (oldTypeNames.has(typeName)) {
      const oldType = oldSchema.__schema.types.find((t: any) => t.name === typeName);
      const newType = newSchema.__schema.types.find((t: any) => t.name === typeName);

      if (!oldType.fields || !newType.fields) continue;

      // Create field maps for quick lookups
      const oldFieldMap = new Map(oldType.fields.map((f: any) => [f.name, f]));
      const newFieldMap = new Map(newType.fields.map((f: any) => [f.name, f]));

      const addedFields: string[] = [];
      const removedFields: string[] = [];
      const changedFields: any[] = [];

      // Find added fields
      for (const [fieldName, field] of newFieldMap.entries()) {
        if (!oldFieldMap.has(fieldName)) {
          addedFields.push(fieldName);
        }
      }

      // Find removed fields
      for (const [fieldName, field] of oldFieldMap.entries()) {
        if (!newFieldMap.has(fieldName)) {
          removedFields.push(fieldName);
        }
      }

      // Find changed fields
      for (const [fieldName, newField] of newFieldMap.entries()) {
        const oldField = oldFieldMap.get(fieldName);
        if (oldField) {
          const changes: string[] = [];

          // Check for type changes
          const oldTypeStr = JSON.stringify(oldField.type);
          const newTypeStr = JSON.stringify(newField.type);
          if (oldTypeStr !== newTypeStr) {
            changes.push(`type changed from ${oldTypeStr} to ${newTypeStr}`);
          }

          // Check for deprecation changes
          if (oldField.isDeprecated !== newField.isDeprecated) {
            changes.push(newField.isDeprecated ? 'field deprecated' : 'field undeprecated');
          }

          // Check for changes in arguments
          if (oldField.args && newField.args) {
            const oldArgMap = new Map(oldField.args.map((a: any) => [a.name, a]));
            const newArgMap = new Map(newField.args.map((a: any) => [a.name, a]));

            // Find added args
            for (const [argName, arg] of newArgMap.entries()) {
              if (!oldArgMap.has(argName)) {
                changes.push(`added argument ${argName}`);
              }
            }

            // Find removed args
            for (const [argName, arg] of oldArgMap.entries()) {
              if (!newArgMap.has(argName)) {
                changes.push(`removed argument ${argName}`);
              }
            }

            // Find changed args
            for (const [argName, newArg] of newArgMap.entries()) {
              const oldArg = oldArgMap.get(argName);
              if (oldArg) {
                if (JSON.stringify(oldArg.type) !== JSON.stringify(newArg.type)) {
                  changes.push(`argument ${argName} type changed`);
                }
                if (oldArg.defaultValue !== newArg.defaultValue) {
                  changes.push(`argument ${argName} default value changed`);
                }
              }
            }
          }

          if (changes.length > 0) {
            changedFields.push({
              fieldName,
              oldType: oldTypeStr,
              newType: newTypeStr,
              changes
            });
          }
        }
      }

      if (addedFields.length > 0 || removedFields.length > 0 || changedFields.length > 0) {
        changedTypes.push({
          typeName,
          addedFields,
          removedFields,
          changedFields
        });
      }
    }
  }

  // Determine severity of changes
  let severity: 'info' | 'warning' | 'critical' = 'info';
  
  if (removedTypes.length > 0 || changedTypes.some(t => t.removedFields.length > 0)) {
    severity = 'critical'; // Breaking changes
  } else if (changedTypes.some(t => t.changedFields.length > 0)) {
    severity = 'warning'; // Potentially breaking changes
  }

  return {
    apiVersions: {
      old: oldVersion,
      new: newVersion
    },
    newTypes,
    removedTypes,
    changedTypes,
    severity
  };
}

async function fetchShopifySchema(shopDomain: string, accessToken: string, apiVersion: string): Promise<any> {
  const endpoint = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;
  const introspectionQuery = {
    query: `
      query IntrospectionQuery {
        __schema {
          queryType { name }
          mutationType { name }
          subscriptionType { name }
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
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
  };

  // Add unique request ID for request tracking
  const requestId = crypto.randomUUID();

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
      'X-Request-ID': requestId,
    },
    body: JSON.stringify(introspectionQuery),
  });

  // Extract rate limit information
  const rateLimitHeader = response.headers.get('X-Shopify-Shop-Api-Call-Limit');
  const rateLimitInfo = {
    available: parseInt(rateLimitHeader?.split('/')[0] || '0'),
    maximum: parseInt(rateLimitHeader?.split('/')[1] || '0'),
    restoreRate: 50, // Default restore rate is 50 points per second
    requestCost: 10, // Introspection queries are expensive
  };

  if (!response.ok) {
    const errorText = await response.text();
    throw {
      status: response.status,
      message: `Failed to fetch Shopify schema: ${errorText}`,
      rateLimitInfo,
      requestId,
    };
  }

  const data = await response.json();
  
  // Check for GraphQL errors
  if (data.errors) {
    throw {
      status: 400,
      message: `GraphQL errors: ${data.errors.map((e: any) => e.message).join(', ')}`,
      graphqlErrors: data.errors,
      rateLimitInfo,
      requestId,
    };
  }

  return {
    schema: data.data,
    rateLimitInfo,
    requestId,
    statusCode: response.status,
    responseSize: JSON.stringify(data).length,
  };
}

async function validateSchema(schema: any): Promise<{ isValid: boolean, errors: string[] }> {
  // Performs basic schema validation
  const errors: string[] = [];

  if (!schema || !schema.__schema) {
    errors.push('Schema is missing or does not contain __schema property');
    return { isValid: false, errors };
  }

  // Check for required types
  const requiredTypes = ['Query', 'Mutation'];
  const schemaTypes = schema.__schema.types.map((t: any) => t.name);
  
  for (const requiredType of requiredTypes) {
    if (!schemaTypes.includes(requiredType)) {
      errors.push(`Schema is missing required type: ${requiredType}`);
    }
  }

  // Check for common Shopify types
  const commonShopifyTypes = [
    'Product', 'Order', 'Customer', 'Shop',
    'Collection', 'Metafield', 'ProductVariant'
  ];
  
  const missingShopifyTypes = commonShopifyTypes.filter(
    type => !schemaTypes.includes(type)
  );
  
  if (missingShopifyTypes.length > 0) {
    errors.push(`Schema is missing common Shopify types: ${missingShopifyTypes.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Main handler for the function
Deno.serve(async (req) => {
  // Handle CORS for preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const requestStart = Date.now();
  const requestId = crypto.randomUUID();
  
  try {
    const params = await req.json() as SchemaFetchParams;
    
    if (!params.sourceId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameter: sourceId',
          requestId
        }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
          } 
        }
      );
    }
    
    // Initialize Supabase client
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Authentication required',
          requestId 
        }),
        { 
          status: 401, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
          } 
        }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid authentication token',
          details: authError.message,
          requestId 
        }),
        { 
          status: 401, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
          } 
        }
      );
    }
    
    const userId = authData.user?.id;
    
    if (!userId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unable to determine user ID from token',
          requestId 
        }),
        { 
          status: 401, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
          } 
        }
      );
    }
    
    // Get source info
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .select('*')
      .eq('id', params.sourceId)
      .single();
    
    if (sourceError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Error fetching source: ${sourceError.message}`,
          requestId 
        }),
        { 
          status: 500, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
          } 
        }
      );
    }
    
    if (!source) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Source not found',
          requestId 
        }),
        { 
          status: 404, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
          } 
        }
      );
    }
    
    // Ensure source belongs to the authenticated user
    if (source.user_id !== userId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'You do not have permission to access this source',
          requestId 
        }),
        { 
          status: 403, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
          } 
        }
      );
    }
    
    // Ensure source is Shopify and connected
    if (source.type !== 'shopify') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Source must be a Shopify store',
          requestId 
        }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
          } 
        }
      );
    }
    
    if (source.connection_status !== 'connected') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Shopify source is not connected',
          requestId 
        }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
          } 
        }
      );
    }
    
    // Use the provided API version or fall back to the source's version
    const apiVersion = params.apiVersion || source.api_version || '2024-04';
    
    // Check if we have a cached schema and it's still valid
    if (!params.forceFresh) {
      const { data: cachedSchema, error: cacheError } = await supabase
        .from('api_schemas')
        .select('*')
        .eq('source_id', params.sourceId)
        .eq('api_version', apiVersion)
        .single();
      
      if (!cacheError && cachedSchema && cachedSchema.cache_valid_until && new Date(cachedSchema.cache_valid_until) > new Date()) {
        // Return cached schema
        const executionTime = Date.now() - requestStart;
        
        // Create audit log for cache hit
        await supabase
          .from('audit_logs')
          .insert({
            table_name: 'schema_operations',
            record_id: params.sourceId,
            action: 'FETCH_SCHEMA_CACHE_HIT',
            user_id: userId,
            new_data: {
              api_version: apiVersion,
              cache_hit: true,
              execution_time_ms: executionTime,
              timestamp: new Date().toISOString(),
              request_id: requestId
            },
          });
        
        return new Response(
          JSON.stringify({
            success: true,
            schema: cachedSchema.schema,
            apiVersion,
            cached: true,
            lastUpdated: cachedSchema.updated_at,
            hash: cachedSchema.schema_hash,
            metrics: {
              executionTimeMs: executionTime,
              schemaSize: JSON.stringify(cachedSchema.schema).length,
              requestId,
              statusCode: 200,
            }
          } as SchemaResponse),
          { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'X-Request-ID': requestId,
              'X-Execution-Time': executionTime.toString()
            } 
          }
        );
      }
    }
    
    // Get the actual access token using the RPC function
    const { data: tokenData, error: tokenError } = await supabase.rpc(
      'decrypt_access_token',
      { encrypted_token: source.access_token, user_uuid: source.user_id }
    );
    
    if (tokenError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Error decrypting access token: ${tokenError.message}`,
          requestId 
        }),
        { 
          status: 500, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
          } 
        }
      );
    }
    
    if (!tokenData) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not decrypt access token',
          requestId 
        }),
        { 
          status: 500, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
          } 
        }
      );
    }
    
    const shopDomain = source.store_name;
    const accessToken = tokenData;
    
    // Create audit log for fetch start
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'schema_operations',
        record_id: params.sourceId,
        action: 'FETCH_SCHEMA_START',
        user_id: userId,
        new_data: {
          api_version: apiVersion,
          timestamp: new Date().toISOString(),
          request_id: requestId
        },
      });
    
    try {
      // Fetch the schema from Shopify
      const { schema, rateLimitInfo, requestId: schemaRequestId, statusCode, responseSize } = 
        await fetchShopifySchema(shopDomain, accessToken, apiVersion);
      
      // Validate the fetched schema
      const validation = await validateSchema(schema);
      
      if (!validation.isValid) {
        // Log validation error
        await supabase
          .from('audit_logs')
          .insert({
            table_name: 'schema_operations',
            record_id: params.sourceId,
            action: 'FETCH_SCHEMA_VALIDATION_ERROR',
            user_id: userId,
            new_data: {
              api_version: apiVersion,
              validation_errors: validation.errors,
              timestamp: new Date().toISOString(),
              request_id: requestId
            },
          });
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Schema validation failed: ${validation.errors.join(', ')}`,
            requestId 
          }),
          { 
            status: 400, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'X-Request-ID': requestId
            } 
          }
        );
      }
      
      // Compute schema hash
      const schemaHash = calculateSchemaHash(schema);
      
      // Check for differences with previous schema version if validateChanges is true
      let schemaDiffs = null;
      if (params.validateChanges) {
        // Get the previous schema for comparison
        const { data: prevSchemaData } = await supabase
          .from('api_schemas')
          .select('*')
          .eq('source_id', params.sourceId)
          .neq('api_version', apiVersion)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();
        
        if (prevSchemaData) {
          schemaDiffs = detectSchemaDifferences(
            prevSchemaData.schema, 
            schema, 
            prevSchemaData.api_version, 
            apiVersion
          );
          
          // If schema differences are detected and have severity > info, save them
          if (schemaDiffs && schemaDiffs.severity !== 'info') {
            await supabase
              .from('schema_diffs')
              .insert({
                source_id: params.sourceId,
                old_api_version: prevSchemaData.api_version,
                new_api_version: apiVersion,
                diff_details: schemaDiffs,
                severity: schemaDiffs.severity
              });
          }
        }
      }
      
      // Cache the schema for 7 days by default
      const cacheValidUntil = new Date();
      cacheValidUntil.setDate(cacheValidUntil.getDate() + 7);
      
      // Upsert the schema in the database
      const { error: upsertError } = await supabase
        .from('api_schemas')
        .upsert({
          source_id: params.sourceId,
          api_version: apiVersion,
          schema: schema,
          schema_hash: schemaHash,
          cache_valid_until: cacheValidUntil.toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'source_id,api_version' });
      
      if (upsertError) {
        console.error('Error upserting schema:', upsertError);
      }
      
      // Update the source with the latest API version and last connected timestamp
      const { error: sourceUpdateError } = await supabase
        .from('sources')
        .update({
          api_version: apiVersion,
          last_connected_at: new Date().toISOString(),
          connection_status: 'connected',
          connection_error: null
        })
        .eq('id', params.sourceId);
      
      if (sourceUpdateError) {
        console.error('Error updating source:', sourceUpdateError);
      }
      
      // Calculate execution time
      const executionTime = Date.now() - requestStart;
      
      // Create audit log for successful completion
      await supabase
        .from('audit_logs')
        .insert({
          table_name: 'schema_operations',
          record_id: params.sourceId,
          action: 'FETCH_SCHEMA_COMPLETE',
          user_id: userId,
          new_data: {
            api_version: apiVersion,
            schema_hash: schemaHash,
            execution_time_ms: executionTime,
            status_code: statusCode,
            rate_limit_info: rateLimitInfo,
            request_size: JSON.stringify(schema).length,
            response_size: responseSize,
            timestamp: new Date().toISOString(),
            request_id: requestId
          },
        });
      
      // Return successful response
      return new Response(
        JSON.stringify({
          success: true,
          schema,
          apiVersion,
          cached: false,
          lastUpdated: new Date().toISOString(),
          hash: schemaHash,
          diffs: schemaDiffs,
          metrics: {
            executionTimeMs: executionTime,
            schemaSize: responseSize,
            requestId,
            statusCode,
            rateLimitInfo
          }
        } as SchemaResponse),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
            'X-Execution-Time': executionTime.toString()
          } 
        }
      );
    } catch (error: any) {
      console.error('Error fetching Shopify schema:', error);
      
      // Update source with error
      const { error: sourceUpdateError } = await supabase
        .from('sources')
        .update({
          connection_error: error.message || 'Unknown error fetching schema',
          connection_status: 'error'
        })
        .eq('id', params.sourceId);
      
      if (sourceUpdateError) {
        console.error('Error updating source with error state:', sourceUpdateError);
      }
      
      // Calculate execution time
      const executionTime = Date.now() - requestStart;
      
      // Create audit log for error
      await supabase
        .from('audit_logs')
        .insert({
          table_name: 'schema_operations',
          record_id: params.sourceId,
          action: 'FETCH_SCHEMA_ERROR',
          user_id: userId,
          new_data: {
            api_version: apiVersion,
            error: error.message || 'Unknown error',
            status_code: error.status || 500,
            execution_time_ms: executionTime,
            timestamp: new Date().toISOString(),
            request_id: requestId,
            rate_limit_info: error.rateLimitInfo
          },
        });
      
      // Determine appropriate status code
      const statusCode = error.status || 
                          (error.message?.includes('rate limit') ? 429 : 
                          error.message?.includes('authentication') ? 401 : 500);
      
      // Include retry header if rate limited
      const headers = { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        'X-Execution-Time': executionTime.toString()
      };
      
      if (error.retryAfter) {
        headers['Retry-After'] = error.retryAfter.toString();
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message || 'Unknown error fetching Shopify schema',
          requestId,
          metrics: {
            executionTimeMs: executionTime,
            statusCode: error.status || 500,
            rateLimitInfo: error.rateLimitInfo
          }
        }),
        { 
          status: statusCode, 
          headers 
        }
      );
    }
  } catch (error: any) {
    console.error('Request parsing error:', error);
    
    // Calculate execution time
    const executionTime = Date.now() - requestStart;
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Invalid request format',
        details: error instanceof Error ? error.message : String(error),
        requestId,
        metrics: {
          executionTimeMs: executionTime
        }
      }),
      { 
        status: 400, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          'X-Execution-Time': executionTime.toString()
        } 
      }
    );
  }
});
