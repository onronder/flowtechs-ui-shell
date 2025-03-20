import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.5';
import { corsHeaders } from '../_shared/cors.ts';

interface CustomExtractionParams {
  sourceId: string;
  datasetId: string;
  query: string;
  variables?: Record<string, any>;
  paginationPath?: string;
  extractionOptions?: {
    maxRecords?: number;
    batchSize?: number;
    timeout?: number;
    forceRefresh?: boolean;
    sampleOnly?: boolean;
    extractionLogId?: string;
  };
}

// Distributed locking implementation to prevent concurrent extractions
class DistributedLock {
  constructor(private supabase: any) {}
  
  async acquire(datasetId: string, ttlSeconds: number = 300): Promise<boolean> {
    try {
      // Generate a unique lock ID
      const lockId = crypto.randomUUID();
      
      // Insert a row in the locks table (will fail if it already exists)
      const { data, error } = await this.supabase.rpc(
        'try_acquire_lock',
        { 
          p_key: `dataset:${datasetId}:extraction`,
          p_lock_id: lockId,
          p_ttl_seconds: ttlSeconds
        }
      );
      
      if (error) {
        console.error('Error acquiring lock:', error);
        return false;
      }
      
      return data === true;
    } catch (error) {
      console.error('Exception acquiring lock:', error);
      return false;
    }
  }
  
  async release(datasetId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.rpc(
        'release_lock',
        { p_key: `dataset:${datasetId}:extraction` }
      );
      
      if (error) {
        console.error('Error releasing lock:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Exception releasing lock:', error);
      return false;
    }
  }
  
  async extend(datasetId: string, ttlSeconds: number = 300): Promise<boolean> {
    try {
      const { error } = await this.supabase.rpc(
        'extend_lock',
        { 
          p_key: `dataset:${datasetId}:extraction`,
          p_ttl_seconds: ttlSeconds
        }
      );
      
      if (error) {
        console.error('Error extending lock:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Exception extending lock:', error);
      return false;
    }
  }
}

// Circuit breaker implementation
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: number | null = null;
  private isOpen = false;
  
  constructor(
    private threshold: number = 5,
    private resetTimeout: number = 30000 // 30 seconds
  ) {}
  
  public recordSuccess(): void {
    this.failures = 0;
    this.isOpen = false;
  }
  
  public recordFailure(): boolean {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.isOpen = true;
    }
    
    return this.isOpen;
  }
  
  public canRequest(): boolean {
    if (!this.isOpen) return true;
    
    if (this.lastFailureTime && (Date.now() - this.lastFailureTime > this.resetTimeout)) {
      // Half-open state - allow one request to try recovery
      return true;
    }
    
    return false;
  }
  
  public getState(): { isOpen: boolean; failures: number; lastFailure: number | null } {
    return {
      isOpen: this.isOpen,
      failures: this.failures,
      lastFailure: this.lastFailureTime
    };
  }
}

// Query validator for ensuring correct GraphQL syntax
function validateGraphQLQuery(query: string): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];
  
  // Basic syntax checks
  if (!query.trim()) {
    errors.push('Query cannot be empty');
    return { valid: false, errors };
  }
  
  // Check for opening and closing braces balance
  const openBraces = (query.match(/{/g) || []).length;
  const closeBraces = (query.match(/}/g) || []).length;
  
  if (openBraces !== closeBraces) {
    errors.push(`Unbalanced braces: ${openBraces} opening vs ${closeBraces} closing`);
  }
  
  // Check for query or mutation keyword
  if (!query.trim().match(/^(query|mutation)\s/i)) {
    errors.push('Query must start with "query" or "mutation" keyword');
  }
  
  // Check for common syntax errors
  if (query.includes('...') && !query.includes('fragment')) {
    errors.push('Query uses spread operator (...) but no fragments are defined');
  }
  
  // Validate variable usage
  const variableMatches = query.match(/\$[a-zA-Z0-9_]+/g);
  if (variableMatches) {
    const variableDeclarations = query.match(/\([^)]*\$[a-zA-Z0-9_]+\s*:\s*[a-zA-Z0-9_![\]]+[^)]*\)/g);
    if (!variableDeclarations) {
      errors.push('Query uses variables but doesn\'t declare their types');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

// Cursor path finder
function extractDataAndCursor(data: any, paginationPath?: string): {
  items: any[];
  hasNextPage: boolean;
  nextCursor?: string;
} {
  // Default extraction strategy
  if (!paginationPath || paginationPath === '') {
    // Look for common patterns
    for (const key of Object.keys(data)) {
      const value = data[key];
      
      // Skip metadata fields
      if (key === '__typename') continue;
      
      if (value && typeof value === 'object') {
        // Check for common GraphQL pagination pattern
        if (value.edges && Array.isArray(value.edges) && value.pageInfo) {
          return {
            items: value.edges.map((edge: any) => edge.node),
            hasNextPage: value.pageInfo.hasNextPage,
            nextCursor: value.pageInfo.endCursor
          };
        }
        
        // Check for array with pagination info as sibling
        if (Array.isArray(value) && data.pageInfo) {
          return {
            items: value,
            hasNextPage: data.pageInfo.hasNextPage,
            nextCursor: data.pageInfo.endCursor
          };
        }
        
        // Check nested objects
        for (const subKey of Object.keys(value)) {
          const subValue = value[subKey];
          
          if (subValue && typeof subValue === 'object') {
            // Check for edges/pageInfo pattern
            if (subValue.edges && Array.isArray(subValue.edges) && subValue.pageInfo) {
              return {
                items: subValue.edges.map((edge: any) => edge.node),
                hasNextPage: subValue.pageInfo.hasNextPage,
                nextCursor: subValue.pageInfo.endCursor
              };
            }
          }
        }
      }
    }
    
    // If no pagination pattern found, return all data as single item
    return { items: [data], hasNextPage: false };
  }
  
  // Use specified pagination path
  try {
    const pathParts = paginationPath.split('.');
    let currentData = data;
    
    // Navigate to the target field
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      
      if (part === 'edges' && i < pathParts.length - 1 && pathParts[i+1] === 'node') {
        // Handle edges.node pattern - extract nodes from edges
        const edges = currentData.edges;
        if (!Array.isArray(edges)) {
          throw new Error(`Expected array at path '${pathParts.slice(0, i+1).join('.')}' but found ${typeof edges}`);
        }
        
        return {
          items: edges.map((edge: any) => edge.node),
          hasNextPage: currentData.pageInfo?.hasNextPage || false,
          nextCursor: currentData.pageInfo?.endCursor
        };
      }
      
      if (currentData[part] === undefined) {
        throw new Error(`Path '${part}' not found in data`);
      }
      
      currentData = currentData[part];
    }
    
    // Check if we found an array
    if (Array.isArray(currentData)) {
      // Look for pageInfo in parent object
      const parentPath = pathParts.slice(0, -1).join('.');
      let parent = data;
      
      if (parentPath) {
        for (const part of parentPath.split('.')) {
          parent = parent[part];
        }
      }
      
      return {
        items: currentData,
        hasNextPage: parent.pageInfo?.hasNextPage || false,
        nextCursor: parent.pageInfo?.endCursor
      };
    }
    
    // Handle connection pattern (edges/node)
    if (currentData.edges && Array.isArray(currentData.edges)) {
      return {
        items: currentData.edges.map((edge: any) => edge.node),
        hasNextPage: currentData.pageInfo?.hasNextPage || false,
        nextCursor: currentData.pageInfo?.endCursor
      };
    }
    
    // If we get here, we found data but not in expected format
    return { items: [currentData], hasNextPage: false };
    
  } catch (error) {
    console.error(`Error extracting data with pagination path '${paginationPath}':`, error);
    // Return empty result on error
    return { items: [], hasNextPage: false };
  }
}

// Main extraction function for custom queries
async function extractCustomData(params: CustomExtractionParams) {
  const {
    sourceId,
    datasetId,
    query,
    variables = {},
    paginationPath,
    extractionOptions = {}
  } = params;
  
  const {
    maxRecords = 1000,
    batchSize = 50,
    timeout = 30000,
    forceRefresh = false,
    sampleOnly = false,
    extractionLogId: providedExtractionLogId
  } = extractionOptions;
  
  const extractionStart = Date.now();
  
  // Initialize Supabase client
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Create lock for avoiding concurrent extractions
  const lock = new DistributedLock(supabase);
  let lockAcquired = false;
  
  // Create circuit breaker for API protection
  const circuitBreaker = new CircuitBreaker(5, 60000); // 5 failures, 1 minute reset
  
  let extractionLogId = providedExtractionLogId;
  let logCreated = false;
  
  try {
    // Validate query syntax
    const queryValidation = validateGraphQLQuery(query);
    if (!queryValidation.valid) {
      throw new Error(`Invalid GraphQL query: ${queryValidation.errors!.join(', ')}`);
    }
    
    // Create extraction log if not provided
    if (!extractionLogId) {
      const { data: logData, error: logError } = await supabase
        .from('extraction_logs')
        .insert({
          dataset_id: datasetId,
          status: 'running',
          start_time: new Date().toISOString(),
          metadata: {
            source_id: sourceId,
            query_preview: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
            has_variables: Object.keys(variables).length > 0,
            extraction_type: 'custom',
            sample_only: sampleOnly
          }
        })
        .select()
        .single();
        
      if (logError) throw new Error(`Error creating extraction log: ${logError.message}`);
      
      extractionLogId = logData.id;
      logCreated = true;
      
      // Update dataset status
      await supabase
        .from('datasets')
        .update({
          status: 'extracting'
        })
        .eq('id', datasetId);
    }
    
    // Only acquire lock for full extractions
    if (!sampleOnly) {
      lockAcquired = await lock.acquire(datasetId);
      
      if (!lockAcquired) {
        throw new Error('Another extraction is already in progress for this dataset');
      }
      
      // Set up lock extension interval
      const lockInterval = setInterval(async () => {
        await lock.extend(datasetId);
      }, 4 * 60 * 1000); // Extend every 4 minutes
      
      // Clean up interval if needed
      setTimeout(() => clearInterval(lockInterval), 30 * 60 * 1000); // Max 30 minutes
    }
    
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
    const { data: accessToken, error: tokenError } = await supabase.rpc(
      'decrypt_access_token',
      { encrypted_token: source.access_token, user_uuid: source.user_id }
    );
    
    if (tokenError) throw new Error(`Error decrypting access token: ${tokenError.message}`);
    if (!accessToken) throw new Error('Could not decrypt access token');
    
    const shopDomain = source.store_name || '';
    const apiVersion = source.api_version || '2024-04';
    
    // Tracking variables
    let allItems: any[] = [];
    let hasMore = true;
    let nextCursor: string | undefined;
    let currentPage = 1;
    const apiCalls: Array<{
      time: number;
      itemCount: number;
      rateLimitInfo: Record<string, any>;
    }> = [];
    
    // Update log with extraction parameters
    await supabase
      .from('extraction_logs')
      .update({
        metadata: {
          source_id: sourceId,
          shop_domain: shopDomain,
          extraction_type: 'custom',
          max_records: maxRecords,
          batch_size: batchSize,
          sample_only: sampleOnly,
          pagination_path: paginationPath || 'auto-detect',
          query_size: query.length,
          variable_count: Object.keys(variables).length
        }
      })
      .eq('id', extractionLogId);
    
    // Main extraction loop
    while (hasMore && allItems.length < maxRecords) {
      // Check circuit breaker
      if (!circuitBreaker.canRequest()) {
        throw new Error('Circuit breaker is open - too many failed API requests');
      }
      
      // Set up query variables with cursor if we have one
      const currentVariables = { ...variables };
      if (nextCursor) {
        // If the query already accepts a cursor variable, use it
        if ('cursor' in currentVariables) {
          currentVariables.cursor = nextCursor;
        } else if ('after' in currentVariables) {
          currentVariables.after = nextCursor;
        }
        // Otherwise, we'll have to modify the query to add cursor support
      }
      
      const callStartTime = Date.now();
      
      try {
        // Check if we've exceeded timeout
        if (Date.now() - extractionStart > timeout) {
          throw new Error(`Extraction timeout exceeded (${timeout}ms)`);
        }
        
        // Execute API call
        const response = await fetch(`https://${shopDomain}/admin/api/${apiVersion}/graphql.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
            'X-Request-ID': crypto.randomUUID()
          },
          body: JSON.stringify({ 
            query, 
            variables: currentVariables 
          })
        });
        
        // Extract rate limit information
        const rateLimitInfo = {
          available: parseInt(response.headers.get('X-Shopify-Shop-Api-Call-Limit')?.split('/')[0] || '0'),
          maximum: parseInt(response.headers.get('X-Shopify-Shop-Api-Call-Limit')?.split('/')[1] || '0'),
          restoreRate: 50,
          requestCost: 1
        };
        
        // Handle rate limiting
        if (response.status === 429) {
          circuitBreaker.recordFailure();
          const retryAfter = parseInt(response.headers.get('Retry-After') || '10');
          
          // Log rate limit
          await supabase.from('audit_logs').insert({
            table_name: 'extraction_rate_limits',
            record_id: datasetId,
            action: 'RATE_LIMITED',
            user_id: source.user_id,
            new_data: {
              rate_limit_info: rateLimitInfo,
              retry_after: retryAfter,
              timestamp: new Date().toISOString()
            }
          });
          
          // Wait and retry
          await new Promise(resolve => setTimeout(resolve, (retryAfter * 1000) + Math.random() * 500));
          continue; // Retry this batch
        }
        
        // Handle other API errors
        if (!response.ok) {
          circuitBreaker.recordFailure();
          const errorText = await response.text();
          throw new Error(`API error (${response.status}): ${errorText}`);
        }
        
        // Parse response
        const data = await response.json();
        
        // Check for GraphQL errors
        if (data.errors) {
          circuitBreaker.recordFailure();
          const errorMessages = data.errors.map((err: any) => err.message).join(', ');
          throw new Error(`GraphQL errors: ${errorMessages}`);
        }
        
        // Record API success
        circuitBreaker.recordSuccess();
        
        // Extract data using pagination path
        const extracted = extractDataAndCursor(data.data, paginationPath);
        
        // Update tracking variables
        hasMore = extracted.hasNextPage;
        nextCursor = extracted.nextCursor;
        allItems = [...allItems, ...extracted.items];
        
        // Record API call metrics
        apiCalls.push({
          time: Date.now() - callStartTime,
          itemCount: extracted.items.length,
          rateLimitInfo
        });
        
        // Update extraction log periodically
        if (currentPage % 5 === 0 || !hasMore) {
          await supabase
            .from('extraction_logs')
            .update({
              records_processed: allItems.length,
              api_calls: apiCalls.length,
              average_response_time: apiCalls.reduce((sum, call) => sum + call.time, 0) / apiCalls.length,
              metadata: {
                current_page: currentPage,
                has_more: hasMore,
                elapsed_time_ms: Date.now() - extractionStart,
                last_rate_limit_info: apiCalls[apiCalls.length - 1].rateLimitInfo,
                items_per_second: allItems.length / ((Date.now() - extractionStart) / 1000)
              }
            })
            .eq('id', extractionLogId);
        }
        
        // Break if we're just sampling
        if (sampleOnly && allItems.length > 0) {
          break;
        }
        
        // Check if we reached batch size limit
        if (allItems.length >= maxRecords) {
          console.log(`Reached maximum record count (${maxRecords})`);
          hasMore = false;
        }
        
        // Small delay to avoid hitting rate limits too quickly
        if (hasMore) {
          await new Promise(r => setTimeout(r, 100));
        }
        
        currentPage++;
      } catch (error) {
        // If this was a network error, we might want to retry
        if (error.message.includes('fetch') || error.message.includes('network')) {
          console.error(`Network error on page ${currentPage}, retrying:`, error);
          await new Promise(r => setTimeout(r, 1000));
          continue; // Retry this batch
        }
        
        // For other errors, rethrow
        throw error;
      }
    }
    
    // Update dataset with extracted data
    const updateData: Record<string, any> = {
      data_updated_at: new Date().toISOString(),
      record_count: allItems.length,
      last_error_details: null
    };
    
    // Only update full data if not a sample
    if (!sampleOnly) {
      updateData.data = allItems;
      updateData.status = 'ready';
    } else {
      // For sample, just set status to ready
      updateData.status = 'ready';
    }
    
    // Calculate performance metrics
    const totalTime = Date.now() - extractionStart;
    const avgApiTime = apiCalls.reduce((sum, call) => sum + call.time, 0) / (apiCalls.length || 1);
    
    updateData.performance_metrics = {
      records_per_second: allItems.length / (totalTime / 1000),
      api_calls_per_record: apiCalls.length / Math.max(1, allItems.length),
      average_response_time: avgApiTime,
      quota_usage_percentage: apiCalls.length > 0 
        ? 100 - (apiCalls[apiCalls.length - 1].rateLimitInfo.available / apiCalls[apiCalls.length - 1].rateLimitInfo.maximum * 100)
        : 0
    };
    
    await supabase
      .from('datasets')
      .update(updateData)
      .eq('id', datasetId);
    
    // Finalize extraction log
    await supabase
      .from('extraction_logs')
      .update({
        status: 'completed',
        end_time: new Date().toISOString(),
        records_processed: allItems.length,
        total_records: allItems.length,
        api_calls: apiCalls.length,
        average_response_time: avgApiTime,
        metadata: {
          total_pages: currentPage - 1,
          total_time_ms: totalTime,
          average_api_call_time_ms: avgApiTime,
          items_per_api_call: allItems.length / (apiCalls.length || 1),
          extraction_rate: allItems.length / (totalTime / 1000)
        }
      })
      .eq('id', extractionLogId);
    
    // Return results
    return {
      success: true,
      recordCount: allItems.length,
      sample: allItems.slice(0, 10), // First 10 for preview
      hasMore,
      metrics: {
        apiCalls: apiCalls.length,
        totalTimeMs: totalTime,
        averageApiTimeMs: avgApiTime,
        recordsPerSecond: allItems.length / (totalTime / 1000)
      }
    };
    
  } catch (error) {
    console.error('Error in custom data extraction:', error);
    
    // Update extraction log with error
    if (extractionLogId) {
      await supabase
        .from('extraction_logs')
        .update({
          status: 'failed',
          end_time: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : String(error),
          metadata: {
            error_details: error instanceof Error ? error.stack : undefined,
            execution_time_ms: Date.now() - extractionStart,
            circuit_breaker_state: circuitBreaker.getState()
          }
        })
        .eq('id', extractionLogId);
    }
    
    // Update dataset with error
    await supabase
      .from('datasets')
      .update({
        status: 'failed',
        last_error_details: {
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        }
      })
      .eq('id', datasetId);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTimeMs: Date.now() - extractionStart
    };
  } finally {
    // Release lock if acquired
    if (lockAcquired) {
      await lock.release(datasetId);
    }
  }
}

// Main handler for the function
Deno.serve(async (req) => {
  // Handle CORS for preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    const params = await req.json() as CustomExtractionParams;
    
    // Validate required parameters
    if (!params.sourceId || !params.datasetId || !params.query) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required parameters: sourceId, datasetId, and query are required',
          requestId,
          timestamp: new Date().toISOString()
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
          }, 
          status: 400 
        }
      );
    }
    
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          error: 'Authentication required',
          requestId,
          timestamp: new Date().toISOString()
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
          }, 
          status: 401 
        }
      );
    }
    
    // Execute extraction with robust error handling
    try {
      const result = await extractCustomData(params);
      
      // Add execution metrics to response
      const executionTime = Date.now() - startTime;
      
      return new Response(
        JSON.stringify({
          ...result,
          requestId,
          executionTime
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
            'X-Execution-Time': executionTime.toString()
          } 
        }
      );
    } catch (error) {
      // Determine appropriate status code
      const statusCode = error.message?.includes('Rate limit') ? 429 : 
                        error.message?.includes('not found') ? 404 : 
                        error.message?.includes('Authentication') ? 401 : 
                        error.message?.includes('Circuit breaker') ? 503 : 
                        error.message?.includes('Another extraction') ? 409 : 
                        error.message?.includes('Invalid GraphQL') ? 400 : 500;
      
      // Include retry header if rate limited
      const headers = { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      };
      
      if (error.retryAfter) {
        headers['Retry-After'] = error.retryAfter.toString();
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error instanceof Error ? error.message : String(error),
          errorCode: statusCode,
          requestId,
          timestamp: new Date().toISOString(),
          executionTime: Date.now() - startTime
        }),
        { status: statusCode, headers }
      );
    }
  } catch (error) {
    // Handle request parsing errors
    return new Response(
      JSON.stringify({ 
        error: 'Invalid request format',
        details: error instanceof Error ? error.message : String(error),
        requestId,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        }, 
        status: 400 
      }
    );
  }
});
