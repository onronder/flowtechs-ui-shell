
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.5';
import { corsHeaders } from '../_shared/cors.ts';

interface ExtractParams {
  sourceId: string;
  datasetId: string;
  queryType: string;
  queryName: string;
  queryDetails: Record<string, any>;
  extractionLogId: string;
  cursor?: string;
  sampleOnly?: boolean;
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

// Response cache implementation
class ResponseCache {
  private cache = new Map<string, {
    data: any;
    timestamp: number;
    expiresAt: number;
  }>();
  
  constructor(private ttlMs: number = 300000) {} // Default 5 minutes TTL
  
  generateKey(sourceId: string, queryName: string, cursor?: string, filter?: string): string {
    return `${sourceId}:${queryName}:${cursor || 'null'}:${filter || 'null'}`;
  }
  
  get(key: string): any | null {
    if (!this.cache.has(key)) return null;
    
    const entry = this.cache.get(key)!;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  set(key: string, data: any, ttlMs?: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + (ttlMs || this.ttlMs)
    });
    
    // Cleanup old entries periodically
    if (this.cache.size % 10 === 0) {
      this.cleanup();
    }
  }
  
  invalidate(sourceId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${sourceId}:`)) {
        this.cache.delete(key);
      }
    }
  }
  
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }
}

// Sample GraphQL queries for different Shopify entity types with field selection optimization
const generateShopifyQuery = (queryName: string, fieldSelection: string[] = [], cursor?: string): string => {
  const baseQueries: Record<string, string> = {
    products: `
      query getProducts($cursor: String) {
        products(first: 50, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              title
              handle
              description
              productType
              status
              createdAt
              updatedAt
              publishedAt
              vendor
              tags
              priceRangeV2 {
                minVariantPrice {
                  amount
                  currencyCode
                }
                maxVariantPrice {
                  amount
                  currencyCode
                }
              }
              __VARIANTS__
              __IMAGES__
              __METAFIELDS__
            }
          }
        }
      }
    `,
    
    orders: `
      query getOrders($cursor: String, $query: String) {
        orders(first: 50, after: $cursor, query: $query) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              name
              email
              phone
              totalPrice {
                amount
                currencyCode
              }
              subtotalPrice {
                amount
                currencyCode
              }
              totalShippingPrice {
                amount
                currencyCode
              }
              totalTax {
                amount
                currencyCode
              }
              createdAt
              updatedAt
              displayFinancialStatus
              displayFulfillmentStatus
              customer {
                id
                firstName
                lastName
                email
                phone
              }
              __ADDRESSES__
              __LINE_ITEMS__
              __FULFILLMENTS__
            }
          }
        }
      }
    `,
    
    customers: `
      query getCustomers($cursor: String) {
        customers(first: 50, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              firstName
              lastName
              email
              phone
              createdAt
              updatedAt
              tags
              __ADDRESSES__
              ordersCount
              totalSpent {
                amount
                currencyCode
              }
              lastOrder {
                id
                name
                createdAt
              }
            }
          }
        }
      }
    `
  };
  
  // Field selection sections for optimization
  const fieldSections: Record<string, Record<string, string>> = {
    products: {
      VARIANTS: `
        variants(first: 20) {
          edges {
            node {
              id
              title
              price
              sku
              inventoryQuantity
              selectedOptions {
                name
                value
              }
            }
          }
        }
      `,
      IMAGES: `
        images(first: 10) {
          edges {
            node {
              id
              url
              altText
              width
              height
            }
          }
        }
      `,
      METAFIELDS: `
        metafields(first: 10) {
          edges {
            node {
              id
              namespace
              key
              value
              type
            }
          }
        }
      `
    },
    orders: {
      ADDRESSES: `
        shippingAddress {
          address1
          address2
          city
          province
          country
          zip
          phone
        }
      `,
      LINE_ITEMS: `
        lineItems(first: 50) {
          edges {
            node {
              id
              title
              quantity
              originalUnitPrice {
                amount
                currencyCode
              }
              variant {
                id
                title
                sku
              }
            }
          }
        }
      `,
      FULFILLMENTS: `
        fulfillments {
          id
          status
          createdAt
          trackingInfo {
            company
            number
            url
          }
        }
      `
    },
    customers: {
      ADDRESSES: `
        defaultAddress {
          id
          address1
          address2
          city
          province
          country
          zip
          phone
        }
        addresses(first: 10) {
          edges {
            node {
              id
              address1
              address2
              city
              province
              country
              zip
              phone
            }
          }
        }
      `
    }
  };
  
  // Start with the base query for the requested entity
  let query = baseQueries[queryName] || '';
  
  // Apply field selection optimizations
  if (fieldSections[queryName]) {
    const sections = fieldSections[queryName];
    
    Object.keys(sections).forEach(sectionKey => {
      const placeholder = `__${sectionKey}__`;
      // Include this section only if it's in the fieldSelection array, or if fieldSelection is empty
      const included = fieldSelection.length === 0 || 
                     fieldSelection.some(f => f.toLowerCase() === sectionKey.toLowerCase());
      
      query = query.replace(placeholder, included ? sections[sectionKey] : '');
    });
  }
  
  return query;
};

// Helper function to get extraction settings from the dataset
async function getExtractionSettings(supabase: any, datasetId: string) {
  try {
    const { data, error } = await supabase
      .from('datasets')
      .select('extraction_settings')
      .eq('id', datasetId)
      .single();
    
    if (error) throw error;
    
    return data.extraction_settings || {
      batch_size: 100,
      max_retries: 3,
      throttle_delay_ms: 1000,
      circuit_breaker_threshold: 5,
      timeout_seconds: 30,
      concurrent_requests: 1,
      deduplication_enabled: true,
      cache_enabled: true,
      field_optimization: true
    };
  } catch (error) {
    console.error('Error getting extraction settings:', error);
    
    // Return defaults
    return {
      batch_size: 100,
      max_retries: 3,
      throttle_delay_ms: 1000,
      circuit_breaker_threshold: 5,
      timeout_seconds: 30,
      concurrent_requests: 1,
      deduplication_enabled: true,
      cache_enabled: true,
      field_optimization: true
    };
  }
}

// Core extraction function with proper error handling
async function extractShopifyData(params: ExtractParams) {
  const { sourceId, datasetId, queryType, queryName, queryDetails, extractionLogId, cursor, sampleOnly } = params;
  
  // Set up performance tracking
  const extractionStart = Date.now();
  
  // Initialize Supabase client
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Create distributed lock and cache instances
  const lock = new DistributedLock(supabase);
  const cache = new ResponseCache(5 * 60 * 1000); // 5 minute cache
  
  let lockAcquired = false;
  
  try {
    // Only acquire a lock for full extractions (not samples)
    if (!sampleOnly) {
      lockAcquired = await lock.acquire(datasetId);
      
      if (!lockAcquired) {
        throw new Error('Another extraction is already in progress for this dataset');
      }
      
      // Set up a lock extension interval (every 4 minutes)
      const lockInterval = setInterval(async () => {
        await lock.extend(datasetId);
      }, 4 * 60 * 1000);
      
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
    
    // Get extraction settings
    const extractionSettings = await getExtractionSettings(supabase, datasetId);
    
    // Create circuit breaker based on settings
    const circuitBreaker = new CircuitBreaker(
      extractionSettings.circuit_breaker_threshold || 5,
      30000
    );
    
    // Determine which fields to include based on query details
    const fieldSelection: string[] = [];
    if (queryName === 'products') {
      if (queryDetails.include_variants) fieldSelection.push('VARIANTS');
      if (queryDetails.include_images) fieldSelection.push('IMAGES');
      if (queryDetails.include_metafields) fieldSelection.push('METAFIELDS');
    } else if (queryName === 'orders') {
      if (queryDetails.include_line_items) fieldSelection.push('LINE_ITEMS');
      if (queryDetails.include_fulfillments) fieldSelection.push('FULFILLMENTS');
      if (queryDetails.include_addresses) fieldSelection.push('ADDRESSES');
    } else if (queryName === 'customers') {
      if (queryDetails.include_addresses) fieldSelection.push('ADDRESSES');
    }
    
    // Generate optimized GraphQL query
    const query = generateShopifyQuery(queryName, fieldSelection, cursor);
    
    // Prepare variables
    const variables: Record<string, any> = { cursor };
    
    // For orders, handle date filters
    if (queryName === 'orders' && queryDetails.date_range) {
      let dateQuery = '';
      const dateRange = queryDetails.date_range;
      
      if (dateRange === '30d') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        dateQuery = `created_at:>=${thirtyDaysAgo.toISOString()}`;
      } else if (dateRange === '90d') {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        dateQuery = `created_at:>=${ninetyDaysAgo.toISOString()}`;
      } else if (dateRange === 'all') {
        dateQuery = '';
      }
      
      variables.query = dateQuery;
    }
    
    // Check cache if enabled
    let cachedResult = null;
    if (extractionSettings.cache_enabled && !sampleOnly) {
      const cacheKey = cache.generateKey(
        sourceId, 
        queryName, 
        cursor, 
        queryName === 'orders' ? variables.query : undefined
      );
      
      cachedResult = cache.get(cacheKey);
      
      if (cachedResult) {
        console.log(`Using cached data for ${queryName} at cursor ${cursor || 'start'}`);
        
        // Update extraction log with cache hit
        await updateExtractionLog(supabase, extractionLogId, {
          api_calls: 0,
          records_processed: cachedResult.edges.length,
          average_response_time: 0,
          metadata: {
            cache_hit: true,
            execution_step: cursor ? 'pagination' : 'initial',
            cursor: cachedResult.pageInfo.endCursor
          }
        });
        
        // Process the items from cache
        const items = cachedResult.edges.map((edge: any) => edge.node);
        
        // If this is a sample extraction or there are no more pages, update the dataset
        if (sampleOnly || !cachedResult.pageInfo.hasNextPage) {
          await updateDataset(supabase, datasetId, items, !cursor, sampleOnly);
          
          // If sampling only, we're done
          if (sampleOnly) {
            await finalizeExtractionLog(supabase, extractionLogId, {
              status: 'completed',
              total_records: items.length,
              end_time: new Date().toISOString()
            });
            
            return {
              success: true,
              message: 'Sample data extracted successfully (from cache)',
              sample: items.slice(0, 10), // Return first 10 for preview
              hasMore: cachedResult.pageInfo.hasNextPage,
              count: items.length
            };
          }
        }
        
        // If we're at the start of extraction, update total_records estimate
        if (!cursor) {
          // If it's a full extraction and there are more pages, we need to continue
          // The total count estimation is rough (API doesn't provide exact count)
          const estimatedTotal = cachedResult.pageInfo.hasNextPage ? items.length * 10 : items.length;
          
          await updateExtractionLog(supabase, extractionLogId, {
            total_records: estimatedTotal
          });
        }
        
        // Return result with pagination info for continued extraction
        return {
          success: true,
          hasMore: cachedResult.pageInfo.hasNextPage,
          nextCursor: cachedResult.pageInfo.endCursor,
          count: items.length,
          total: cachedResult.edges ? cachedResult.edges.length : 0,
          sample: items.slice(0, 10), // Return first 10 for preview
          fromCache: true
        };
      }
    }
    
    // No cache hit - need to make an API call
    
    // Check circuit breaker
    if (!circuitBreaker.canRequest()) {
      throw new Error('Circuit breaker is open - too many failed requests');
    }
    
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
    
    // Execute the query with retries and error handling
    let retryCount = 0;
    let result;
    
    // Exponential backoff retry function
    const executeWithRetry = async () => {
      try {
        // Call Shopify GraphQL API
        const response = await fetch(`https://${shopDomain}/admin/api/${apiVersion}/graphql.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
            'X-Request-ID': crypto.randomUUID() // For request tracing
          },
          body: JSON.stringify({ query, variables })
        });
        
        // Extract rate limit information
        const rateLimitInfo = {
          available: parseInt(response.headers.get('X-Shopify-Shop-Api-Call-Limit')?.split('/')[0] || '0'),
          maximum: parseInt(response.headers.get('X-Shopify-Shop-Api-Call-Limit')?.split('/')[1] || '0'),
          restoreRate: 50, // Typical restore rate of 50 points/second
          requestCost: 1 // Default cost, more complex queries may cost more
        };
        
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '1');
          
          // Log rate limiting event
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
          
          if (retryCount < extractionSettings.max_retries) {
            retryCount++;
            // Wait for the retry-after period plus a small random jitter
            const jitter = Math.floor(Math.random() * 500);
            await new Promise(resolve => setTimeout(resolve, (retryAfter * 1000) + jitter));
            return executeWithRetry(); // Recursive retry
          } else {
            circuitBreaker.recordFailure();
            throw new Error(`Rate limit exceeded and max retries reached`);
          }
        }
        
        // Handle other error responses
        if (!response.ok) {
          const errorText = await response.text();
          if (retryCount < extractionSettings.max_retries && (response.status >= 500 || response.status === 408)) {
            retryCount++;
            // Exponential backoff for server errors
            const backoffTime = Math.min(1000 * Math.pow(2, retryCount) + Math.random() * 1000, 10000);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            return executeWithRetry(); // Recursive retry
          }
          
          circuitBreaker.recordFailure();
          throw new Error(`Server error (${response.status}): ${errorText}`);
        }
        
        // Parse response
        const data = await response.json();
        
        // Check for GraphQL errors
        if (data.errors) {
          // Determine if errors are retryable
          const hasRetryableError = data.errors.some((err: any) => {
            const code = err.extensions?.code;
            return code === 'THROTTLED' || code === 'INTERNAL_SERVER_ERROR' || code === 'TIMEOUT';
          });
          
          if (hasRetryableError && retryCount < extractionSettings.max_retries) {
            retryCount++;
            const backoffTime = Math.min(1000 * Math.pow(2, retryCount) + Math.random() * 1000, 10000);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            return executeWithRetry(); // Recursive retry
          }
          
          circuitBreaker.recordFailure();
          throw new Error(`GraphQL errors: ${data.errors.map((e: any) => e.message).join(', ')}`);
        }
        
        // Record success with circuit breaker
        circuitBreaker.recordSuccess();
        
        return {
          data,
          rateLimitInfo,
          responseTime: Date.now() - extractionStart
        };
      } catch (error) {
        if (error.message.includes('fetch') && retryCount < extractionSettings.max_retries) {
          retryCount++;
          const backoffTime = Math.min(1000 * Math.pow(2, retryCount) + Math.random() * 1000, 10000);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          return executeWithRetry(); // Recursive retry for network errors
        }
        throw error;
      }
    };
    
    // Execute query with retries
    result = await executeWithRetry();
    
    // Extract and validate the data
    if (!result.data.data || !result.data.data[queryName]) {
      throw new Error(`Invalid response format: missing ${queryName} field`);
    }
    
    // Get data and page info
    const entityData = result.data.data[queryName];
    const hasNextPage = entityData.pageInfo.hasNextPage;
    const nextCursor = entityData.pageInfo.endCursor;
    
    // Process the items
    const items = entityData.edges.map((edge: any) => edge.node);
    
    // Store in cache if enabled
    if (extractionSettings.cache_enabled) {
      const cacheKey = cache.generateKey(
        sourceId, 
        queryName, 
        cursor,
        queryName === 'orders' ? variables.query : undefined
      );
      
      cache.set(cacheKey, entityData);
    }
    
    // Update extraction log with progress
    await updateExtractionLog(supabase, extractionLogId, {
      api_calls: 1,
      records_processed: items.length,
      average_response_time: result.responseTime,
      metadata: {
        rate_limit: result.rateLimitInfo,
        execution_step: cursor ? 'pagination' : 'initial',
        cursor: nextCursor,
        query_details: {
          query_size: query.length,
          response_size: JSON.stringify(entityData).length,
          field_selection: fieldSelection
        }
      }
    });
    
    // If this is a sample extraction or there are no more pages, update the dataset
    if (sampleOnly || !hasNextPage) {
      await updateDataset(supabase, datasetId, items, !cursor, sampleOnly);
      
      // If sampling only, we're done
      if (sampleOnly) {
        await finalizeExtractionLog(supabase, extractionLogId, {
          status: 'completed',
          total_records: items.length,
          end_time: new Date().toISOString()
        });
        
        return {
          success: true,
          message: 'Sample data extracted successfully',
          sample: items.slice(0, 10), // Return first 10 for preview
          hasMore: hasNextPage,
          count: items.length
        };
      }
    }
    
    // If we're at the start of extraction, update total_records estimate
    if (!cursor) {
      // If it's a full extraction and there are more pages, we need to continue
      // The total count estimation is rough (API doesn't provide exact count)
      const estimatedTotal = hasNextPage ? items.length * 10 : items.length;
      
      await updateExtractionLog(supabase, extractionLogId, {
        total_records: estimatedTotal
      });
    }
    
    // Return result with pagination info for continued extraction
    return {
      success: true,
      hasMore: hasNextPage,
      nextCursor: nextCursor,
      count: items.length,
      total: entityData.edges ? entityData.edges.length : 0,
      sample: items.slice(0, 10), // Return first 10 for preview
      rateLimitInfo: result.rateLimitInfo,
      responseTime: result.responseTime
    };
  } catch (error) {
    console.error('Error in extraction:', error);
    
    // Update extraction log with error
    await updateExtractionLogError(
      supabase, 
      extractionLogId, 
      error instanceof Error ? error.message : String(error),
      {
        circuit_breaker_state: circuitBreaker?.getState(),
        error_stack: error instanceof Error ? error.stack : undefined,
        extraction_duration_ms: Date.now() - extractionStart
      }
    );
    
    // Update dataset with error info
    await updateDatasetError(
      supabase,
      datasetId,
      error instanceof Error ? error.message : String(error)
    );
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    // Release the lock if we acquired it
    if (lockAcquired) {
      await lock.release(datasetId);
    }
  }
}

async function updateExtractionLog(supabase: any, logId: string, updates: Record<string, any>) {
  try {
    const { error } = await supabase
      .from('extraction_logs')
      .update(updates)
      .eq('id', logId);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error updating extraction log:', error);
  }
}

async function finalizeExtractionLog(supabase: any, logId: string, updates: Record<string, any>) {
  try {
    const { error } = await supabase
      .from('extraction_logs')
      .update({
        ...updates,
        end_time: new Date().toISOString()
      })
      .eq('id', logId);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error finalizing extraction log:', error);
  }
}

async function updateExtractionLogError(
  supabase: any, 
  logId: string, 
  errorMessage: string,
  additionalData: Record<string, any> = {}
) {
  try {
    const { error } = await supabase
      .from('extraction_logs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        end_time: new Date().toISOString(),
        metadata: {
          ...additionalData,
          error_timestamp: new Date().toISOString()
        }
      })
      .eq('id', logId);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error updating extraction log with error:', error);
  }
}

async function updateDataset(supabase: any, datasetId: string, items: any[], isFirstBatch: boolean, isSample: boolean) {
  try {
    const updates: Record<string, any> = {
      data_updated_at: new Date().toISOString(),
      record_count: items.length
    };
    
    // Only update the full dataset data if not a sample
    if (!isSample) {
      if (isFirstBatch) {
        // First batch overwrites existing data
        updates.data = items;
      } else {
        // Append to existing data
        const { data: dataset } = await supabase
          .from('datasets')
          .select('data')
          .eq('id', datasetId)
          .single();
        
        if (dataset && dataset.data) {
          updates.data = [...dataset.data, ...items];
          updates.record_count = updates.data.length;
        } else {
          updates.data = items;
        }
      }
    } else {
      // For sample, just store the preview data in the metadata
      updates.status = 'ready';
      updates.last_error_details = null;
    }
    
    // Add performance metrics
    updates.performance_metrics = {
      records_per_second: items.length / ((Date.now() - performance.now()) / 1000),
      api_calls_per_record: 1 / items.length,
      average_response_time: (Date.now() - performance.now()) / 1,
      quota_usage_percentage: 0 // Will be updated when we have rate limit info
    };
    
    const { error } = await supabase
      .from('datasets')
      .update(updates)
      .eq('id', datasetId);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error updating dataset:', error);
  }
}

async function updateDatasetError(supabase: any, datasetId: string, errorMessage: string) {
  try {
    const { error } = await supabase
      .from('datasets')
      .update({
        status: 'failed',
        last_error_details: {
          message: errorMessage,
          timestamp: new Date().toISOString()
        }
      })
      .eq('id', datasetId);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error updating dataset with error:', error);
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
    const params = await req.json() as ExtractParams;
    
    // Validate required parameters
    if (!params.sourceId || !params.datasetId || !params.queryType || !params.queryName) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required parameters',
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
      const result = await extractShopifyData(params);
      
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
                        error.message?.includes('Another extraction') ? 409 : 500;
      
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
