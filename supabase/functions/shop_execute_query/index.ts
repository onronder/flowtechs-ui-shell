
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.5';
import { corsHeaders } from '../_shared/cors.ts';

interface GraphQLRequest {
  query: string;
  variables?: Record<string, any>;
  operationName?: string;
}

interface QueryExecutionParams {
  sourceId: string;
  query: string;
  variables?: Record<string, any>;
  operationName?: string;
  options?: {
    retries?: number;
    retryStatusCodes?: number[];
    cacheResults?: boolean;
    cacheTTL?: number; // in seconds
    timeout?: number; // in milliseconds
    batchKey?: string; // for request batching
  };
}

interface ExecutionMetrics {
  startTime: number;
  endTime?: number;
  retries: number;
  statusCode?: number;
  cacheHit?: boolean;
  responseSize?: number;
  executionMs?: number;
  rateLimitInfo?: {
    available: number;
    maximum: number;
    restoreRate: number;
    requestCost: number;
  };
}

// Circuit breaker implementation for API protection
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: number | null = null;
  private isOpen = false;
  private halfOpenAttempted = false;
  
  constructor(
    private threshold: number = 5,
    private resetTimeoutMs: number = 30000, // 30 seconds
    private readonly sourceId: string,
    private readonly operationTag: string
  ) {}
  
  public canRequest(): boolean {
    if (!this.isOpen) return true;
    
    // Check if we're past the reset timeout
    if (this.lastFailureTime && (Date.now() - this.lastFailureTime > this.resetTimeoutMs)) {
      // Allow one request through in half-open state
      if (!this.halfOpenAttempted) {
        this.halfOpenAttempted = true;
        console.log(`Circuit breaker for ${this.sourceId}/${this.operationTag} in half-open state`);
        return true;
      }
    }
    
    return false;
  }
  
  public recordSuccess(): void {
    this.failures = 0;
    this.isOpen = false;
    this.halfOpenAttempted = false;
    console.log(`Circuit breaker for ${this.sourceId}/${this.operationTag} reset after success`);
  }
  
  public recordFailure(): boolean {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.isOpen) {
      // If we failed during half-open state, extend the timeout
      this.halfOpenAttempted = false;
      console.log(`Circuit breaker for ${this.sourceId}/${this.operationTag} remains open after half-open failure`);
      return true;
    }
    
    if (this.failures >= this.threshold) {
      this.isOpen = true;
      console.log(`Circuit breaker for ${this.sourceId}/${this.operationTag} opened after ${this.failures} failures`);
      return true; // Circuit is now open
    }
    
    return false; // Circuit still closed
  }
  
  public getState(): { isOpen: boolean; failures: number; lastFailureTime: number | null } {
    return {
      isOpen: this.isOpen,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Request batcher for combining similar requests
class RequestBatcher {
  private batches: Map<string, {
    promise: Promise<any>;
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    expiresAt: number;
  }> = new Map();
  
  constructor(
    private readonly maxBatchAgeMs: number = 100 // Default 100ms window
  ) {}
  
  public async getOrCreateBatch(batchKey: string, createFn: () => Promise<any>): Promise<any> {
    // Clean expired batches first
    this.cleanExpiredBatches();
    
    // Check if batch exists and is not expired
    if (this.batches.has(batchKey)) {
      console.log(`Using existing batch for key: ${batchKey}`);
      return this.batches.get(batchKey)!.promise;
    }
    
    // Create new batch
    let resolveFn: (value: any) => void;
    let rejectFn: (reason: any) => void;
    
    const promise = new Promise((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });
    
    this.batches.set(batchKey, {
      promise,
      resolve: resolveFn!,
      reject: rejectFn!,
      expiresAt: Date.now() + this.maxBatchAgeMs
    });
    
    // Execute the batch creator function
    try {
      const result = await createFn();
      this.batches.get(batchKey)?.resolve(result);
      return result;
    } catch (error) {
      this.batches.get(batchKey)?.reject(error);
      throw error;
    } finally {
      // Remove batch after completion
      setTimeout(() => {
        this.batches.delete(batchKey);
      }, this.maxBatchAgeMs);
    }
  }
  
  private cleanExpiredBatches(): void {
    const now = Date.now();
    for (const [key, batch] of this.batches.entries()) {
      if (batch.expiresAt <= now) {
        console.log(`Removing expired batch: ${key}`);
        this.batches.delete(key);
      }
    }
  }
}

// Utility to create a short deterministic hash for batch keys
function createBatchKey(sourceId: string, query: string, variables: Record<string, any> = {}): string {
  // Simple deterministic string for similar requests
  const normalizedQuery = query.replace(/\s+/g, ' ').trim();
  const queryPart = normalizedQuery.substring(0, 50); // First 50 chars of query
  const varPart = JSON.stringify(variables).substring(0, 50); // First 50 chars of variables JSON
  return `${sourceId}:${queryPart}:${varPart}`;
}

// Utility to determine if a failed request can be retried
function isRetryableError(status: number, retryStatusCodes: number[] = [429, 500, 502, 503, 504]): boolean {
  return retryStatusCodes.includes(status);
}

// Simple in-memory cache
const queryCache = new Map<string, {
  data: any;
  expiresAt: number;
}>();

// Create cache key for query results
function createCacheKey(sourceId: string, query: string, variables: Record<string, any> = {}): string {
  return `${sourceId}:${query}:${JSON.stringify(variables)}`;
}

// Retry with exponential backoff
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number,
  retryStatusCodes: number[] = [429, 500, 502, 503, 504],
  initialDelayMs: number = 100
): Promise<T> {
  let retries = 0;
  let lastError: any;
  
  while (retries <= maxRetries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Check if this is a retryable error
      if (error.status && !isRetryableError(error.status, retryStatusCodes)) {
        throw error; // Non-retryable error
      }
      
      if (retries >= maxRetries) {
        break; // Max retries reached
      }
      
      // Calculate backoff delay with jitter
      const delayMs = initialDelayMs * Math.pow(2, retries) + Math.random() * 100;
      console.log(`Retry ${retries + 1}/${maxRetries} after ${delayMs}ms delay`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs));
      retries++;
    }
  }
  
  // If we get here, we've exhausted our retries
  throw lastError;
}

// Function to execute a GraphQL query against Shopify with advanced features
async function executeShopifyQuery(params: QueryExecutionParams) {
  const { 
    sourceId, 
    query, 
    variables = {}, 
    operationName,
    options = {} 
  } = params;
  
  const {
    retries = 3,
    retryStatusCodes = [429, 500, 502, 503, 504],
    cacheResults = false,
    cacheTTL = 300, // 5 minutes default
    timeout = 30000, // 30 seconds default
    batchKey = ''
  } = options;
  
  // Create metrics object for tracking execution
  const metrics: ExecutionMetrics = {
    startTime: Date.now(),
    retries: 0
  };
  
  // Initialize Supabase client
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Use static circuit breakers and batchers
  const circuitBreakers = new Map<string, CircuitBreaker>();
  const requestBatcher = new RequestBatcher();
  
  // Request-specific circuit breaker
  const circuitBreakerKey = `${sourceId}:query`;
  if (!circuitBreakers.has(circuitBreakerKey)) {
    circuitBreakers.set(
      circuitBreakerKey, 
      new CircuitBreaker(5, 60000, sourceId, 'query') // 5 failures, 1 minute reset
    );
  }
  const circuitBreaker = circuitBreakers.get(circuitBreakerKey)!;
  
  try {
    // Check circuit breaker first
    if (!circuitBreaker.canRequest()) {
      throw new Error('Circuit breaker is open - too many failed requests. Try again later.');
    }
    
    // Create log entry
    const { data: logData, error: logError } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'query_operations',
        record_id: sourceId,
        action: 'EXECUTE_QUERY_START',
        user_id: (await supabase.auth.getUser()).data.user?.id,
        new_data: {
          timestamp: new Date().toISOString(),
          query_preview: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
          has_variables: Object.keys(variables || {}).length > 0,
          operation_name: operationName
        },
      })
      .select('id')
      .single();
      
    if (logError) console.error('Error logging operation start:', logError);
    
    const logId = logData?.id;
    
    // Check cache first if caching is enabled
    if (cacheResults) {
      const cacheKey = createCacheKey(sourceId, query, variables);
      if (queryCache.has(cacheKey)) {
        const cached = queryCache.get(cacheKey)!;
        if (cached.expiresAt > Date.now()) {
          // Cache hit!
          metrics.cacheHit = true;
          metrics.endTime = Date.now();
          metrics.executionMs = metrics.endTime - metrics.startTime;
          
          // Update log with cache hit info
          await supabase
            .from('audit_logs')
            .update({
              action: 'EXECUTE_QUERY_CACHE_HIT',
              new_data: {
                cache_hit: true,
                execution_time_ms: metrics.executionMs,
                timestamp: new Date().toISOString()
              }
            })
            .eq('id', logId);
          
          console.log(`Cache hit for ${sourceId} query`);
          return {
            success: true,
            data: cached.data,
            fromCache: true,
            executionTime: metrics.executionMs
          };
        } else {
          // Cache expired, remove it
          queryCache.delete(cacheKey);
        }
      }
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
    const { data: tokenData, error: tokenError } = await supabase.rpc(
      'decrypt_access_token',
      { encrypted_token: source.access_token, user_uuid: source.user_id }
    );
    
    if (tokenError) throw new Error(`Error decrypting access token: ${tokenError.message}`);
    if (!tokenData) throw new Error('Could not decrypt access token');
    
    const shopDomain = source.store_name || '';
    const accessToken = tokenData;
    const apiVersion = source.api_version || '2024-04';
    
    // Check if we should batch this request
    let batchPromise: Promise<any> | null = null;
    
    if (batchKey) {
      const actualBatchKey = batchKey || createBatchKey(sourceId, query, variables);
      
      // Use the batcher to possibly combine similar requests
      batchPromise = requestBatcher.getOrCreateBatch(
        actualBatchKey,
        async () => {
          // This function will only be called once per batch
          return executeSingleRequest(
            shopDomain, 
            accessToken, 
            apiVersion, 
            { query, variables, operationName },
            retries,
            retryStatusCodes,
            metrics,
            timeout
          );
        }
      );
    }
    
    // Execute the request (either directly or via batch)
    const result = batchPromise || await executeSingleRequest(
      shopDomain,
      accessToken,
      apiVersion,
      { query, variables, operationName },
      retries,
      retryStatusCodes,
      metrics,
      timeout
    );
    
    // Update metrics with completion info
    metrics.endTime = Date.now();
    metrics.executionMs = metrics.endTime - metrics.startTime;
    
    // Record success with circuit breaker
    circuitBreaker.recordSuccess();
    
    // Store in cache if enabled
    if (cacheResults && result.success && result.data) {
      const cacheKey = createCacheKey(sourceId, query, variables);
      queryCache.set(cacheKey, {
        data: result.data,
        expiresAt: Date.now() + (cacheTTL * 1000)
      });
      console.log(`Cached result for ${sourceId} query with TTL ${cacheTTL}s`);
    }
    
    // Log completion
    await supabase
      .from('audit_logs')
      .update({
        action: 'EXECUTE_QUERY_COMPLETE',
        new_data: {
          execution_time_ms: metrics.executionMs,
          status_code: metrics.statusCode,
          retries: metrics.retries,
          response_size: metrics.responseSize,
          rate_limit_info: metrics.rateLimitInfo,
          timestamp: new Date().toISOString(),
          batched: !!batchPromise
        }
      })
      .eq('id', logId);
    
    // Return successful response with data and execution metrics
    return {
      success: true,
      data: result.data,
      rateLimitInfo: metrics.rateLimitInfo,
      executionTime: metrics.executionMs,
      fromCache: false
    };
  } catch (error) {
    console.error('Error executing Shopify GraphQL query:', error);
    
    // Record failure with circuit breaker
    circuitBreaker.recordFailure();
    
    // Log error
    await supabase
      .from('audit_logs')
      .insert({
        table_name: 'query_operations',
        record_id: sourceId,
        action: 'EXECUTE_QUERY_ERROR',
        user_id: (await supabase.auth.getUser()).data.user?.id,
        new_data: {
          error: error instanceof Error ? error.message : String(error),
          error_stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
          circuit_breaker_state: circuitBreaker.getState()
        },
      });
    
    throw error;
  }
  
  // Helper function to execute a single request with retries
  async function executeSingleRequest(
    shopDomain: string,
    accessToken: string,
    apiVersion: string,
    requestBody: GraphQLRequest,
    maxRetries: number,
    retryStatusCodes: number[],
    metrics: ExecutionMetrics,
    timeoutMs: number
  ): Promise<any> {
    const endpoint = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;
    
    // Add unique request ID for request tracking
    const requestId = crypto.randomUUID();
    
    try {
      // Use retry wrapper with exponential backoff
      return await retryWithBackoff(
        async () => {
          // Calculate query size for metrics
          const requestSize = JSON.stringify(requestBody).length;
          
          // Create abort controller for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          
          try {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken,
                'X-Request-ID': requestId,
                'X-GraphQL-Cost-Include-Fields': 'true' // Request cost info
              },
              body: JSON.stringify(requestBody),
              signal: controller.signal
            });
            
            // Extract rate limit information
            const rateLimitHeader = response.headers.get('X-Shopify-Shop-Api-Call-Limit');
            const rateLimitInfo = {
              available: parseInt(rateLimitHeader?.split('/')[0] || '0'),
              maximum: parseInt(rateLimitHeader?.split('/')[1] || '0'),
              restoreRate: 50, // Default restore rate is 50 points per second
              requestCost: 1 // Default cost for simple queries
            };
            
            // Update metrics
            metrics.statusCode = response.status;
            metrics.rateLimitInfo = rateLimitInfo;
            
            // Handle rate limiting
            if (response.status === 429) {
              metrics.retries++;
              const retryAfter = parseInt(response.headers.get('Retry-After') || '1');
              const error = new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
              // @ts-ignore: Adding custom properties to error
              error.status = 429;
              // @ts-ignore: Adding custom properties to error
              error.retryAfter = retryAfter;
              throw error;
            }
            
            // Handle other error responses
            if (!response.ok) {
              metrics.retries++;
              const errorText = await response.text();
              const error = new Error(`GraphQL query failed with status ${response.status}: ${errorText}`);
              // @ts-ignore: Adding custom properties to error
              error.status = response.status;
              throw error;
            }
            
            // Parse the response
            const responseText = await response.text();
            metrics.responseSize = responseText.length;
            
            const data = JSON.parse(responseText);
            
            // Check for GraphQL errors
            if (data.errors) {
              // Extract error codes
              const errorCodes = data.errors.map((err: any) => err.extensions?.code || 'UNKNOWN');
              
              // Check if any of the errors are retryable
              const hasRetryableError = errorCodes.some((code: string) => 
                ['THROTTLED', 'INTERNAL_SERVER_ERROR', 'TIMEOUT'].includes(code)
              );
              
              if (hasRetryableError) {
                metrics.retries++;
                const error = new Error(`GraphQL errors: ${data.errors.map((e: any) => e.message).join(', ')}`);
                // @ts-ignore: Adding custom properties to error
                error.status = 500; // Treat as server error for retry purposes
                // @ts-ignore: Adding custom properties to error
                error.graphqlErrors = data.errors;
                throw error;
              }
              
              // Non-retryable GraphQL errors
              return {
                success: false,
                errors: data.errors,
                rateLimitInfo
              };
            }
            
            // Extract cost information if available
            if (data.extensions?.cost) {
              rateLimitInfo.requestCost = data.extensions.cost.requestedQueryCost || 1;
            }
            
            // Success response
            return {
              success: true,
              data: data.data,
              rateLimitInfo
            };
          } finally {
            clearTimeout(timeoutId);
          }
        },
        maxRetries,
        retryStatusCodes
      );
    } catch (error) {
      // Enhance error with request details
      const enhancedError = new Error(`Error executing GraphQL query: ${error.message}`);
      // @ts-ignore: Adding custom properties to error
      enhancedError.originalError = error;
      // @ts-ignore: Adding custom properties to error
      enhancedError.requestId = requestId;
      // @ts-ignore: Adding custom properties to error
      enhancedError.endpoint = endpoint;
      // @ts-ignore: Adding custom properties to error
      enhancedError.metrics = { ...metrics, endTime: Date.now() };
      throw enhancedError;
    }
  }
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
    const params = await req.json() as QueryExecutionParams;
    
    if (!params.sourceId || !params.query) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters: sourceId and query are required',
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
    
    // Validate authentication token
    const authHeader = req.headers.get('Authorization');
    let userId = '';
    
    if (authHeader) {
      // Extract user ID from the JWT
      try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        const token = authHeader.replace('Bearer ', '');
        const { data } = await supabase.auth.getUser(token);
        userId = data.user?.id || '';
      } catch (e) {
        console.error('Error getting user ID from token:', e);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid authentication token',
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
    } else {
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
    
    // Execute the query with full error handling
    try {
      const result = await executeShopifyQuery(params);
      
      const executionTime = Date.now() - requestStart;
      
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
      // Determine appropriate status code from error
      const statusCode = error.message?.includes('Rate limit') ? 429 : 
                        error.message?.includes('not found') ? 404 : 
                        error.message?.includes('Authentication') ? 401 : 
                        error.message?.includes('Circuit breaker') ? 503 : 500;
      
      // Include retry header if rate limited
      const headers = { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-ID': requestId };
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
          executionTime: Date.now() - requestStart
        }),
        { 
          status: statusCode, 
          headers 
        }
      );
    }
  } catch (error) {
    // Handle request parsing errors
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Invalid request format',
        details: error instanceof Error ? error.message : String(error),
        requestId,
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - requestStart
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
});
