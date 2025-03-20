import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.5';
import { corsHeaders } from '../_shared/cors.ts';

interface DependentQueryParams {
  sourceId: string;
  parentType: string;
  parentIds: string[];
  dependentType: string;
  batchSize?: number;
  concurrency?: number;
  options?: {
    includeMetafields?: boolean;
    includeImages?: boolean;
    includeVariants?: boolean;
    extractionLogId?: string;
    cacheResults?: boolean;
    cacheTTL?: number;
  };
}

interface BatchExtractionResult {
  success: boolean;
  data?: any[];
  error?: string;
  batchId?: number;
  parentId?: string;
  metrics?: {
    requestTime: number;
    processedCount: number;
    hasMore: boolean;
    cursor?: string;
  };
}

// Batch processor for concurrent extraction
class BatchProcessor {
  private queue: { parentId: string; batchId: number }[] = [];
  private results: Map<string, BatchExtractionResult> = new Map();
  private pending = 0;
  private completed = 0;
  private failed = 0;
  
  constructor(
    private extractionFn: (parentId: string, batchId: number) => Promise<BatchExtractionResult>,
    private concurrency: number = 2,
    private onBatchComplete?: (result: BatchExtractionResult) => void,
    private onAllComplete?: () => void
  ) {}
  
  addBatch(parentId: string, batchId: number): void {
    this.queue.push({ parentId, batchId });
    this.processQueue();
  }
  
  private async processQueue(): Promise<void> {
    if (this.pending >= this.concurrency || this.queue.length === 0) {
      return;
    }
    
    const batch = this.queue.shift();
    if (!batch) return;
    
    this.pending++;
    
    try {
      console.log(`Processing batch for parent ${batch.parentId} (batch ${batch.batchId})`);
      const result = await this.extractionFn(batch.parentId, batch.batchId);
      
      // Store result
      this.results.set(`${batch.parentId}-${batch.batchId}`, result);
      
      if (result.success) {
        this.completed++;
      } else {
        this.failed++;
      }
      
      // Notify of batch completion
      if (this.onBatchComplete) {
        this.onBatchComplete(result);
      }
    } catch (error) {
      console.error(`Batch error for parent ${batch.parentId}:`, error);
      this.failed++;
      
      // Store error result
      this.results.set(`${batch.parentId}-${batch.batchId}`, {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        batchId: batch.batchId,
        parentId: batch.parentId
      });
      
      // Notify of batch error
      if (this.onBatchComplete) {
        this.onBatchComplete({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          batchId: batch.batchId,
          parentId: batch.parentId
        });
      }
    } finally {
      this.pending--;
      
      // Process more from queue
      this.processQueue();
      
      // Check if we're done
      if (this.pending === 0 && this.queue.length === 0 && this.onAllComplete) {
        this.onAllComplete();
      }
    }
  }
  
  async waitForCompletion(): Promise<Map<string, BatchExtractionResult>> {
    // If nothing is processing, return immediately
    if (this.pending === 0 && this.queue.length === 0) {
      return this.results;
    }
    
    // Otherwise wait for completion
    return new Promise((resolve) => {
      this.onAllComplete = () => {
        resolve(this.results);
      };
    });
  }
  
  getStats(): { queued: number; pending: number; completed: number; failed: number } {
    return {
      queued: this.queue.length,
      pending: this.pending,
      completed: this.completed,
      failed: this.failed
    };
  }
}

// Simple in-memory cache
class DependentQueryCache {
  private static cache = new Map<string, {
    data: any;
    timestamp: number;
    expiresAt: number;
  }>();
  
  static generateKey(
    sourceId: string, 
    parentType: string, 
    parentId: string, 
    dependentType: string,
    options: string = ''
  ): string {
    return `${sourceId}:${parentType}:${parentId}:${dependentType}:${options}`;
  }
  
  static get(key: string): any | null {
    if (!this.cache.has(key)) return null;
    
    const entry = this.cache.get(key)!;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  static set(key: string, data: any, ttlMs: number = 5 * 60 * 1000): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttlMs
    });
    
    // Cleanup old entries periodically
    if (this.cache.size % 10 === 0) {
      this.cleanup();
    }
  }
  
  static invalidate(sourceId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${sourceId}:`)) {
        this.cache.delete(key);
      }
    }
  }
  
  private static cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }
}

// Generate dependent query for a specific parent type and dependent type
function generateDependentQuery(
  parentType: string, 
  dependentType: string, 
  options: {
    includeMetafields?: boolean;
    includeImages?: boolean;
    includeVariants?: boolean;
  } = {}
): string {
  // Define mapping of parent/dependent relationships to queries
  const queryTemplates: Record<string, Record<string, string>> = {
    // Product as parent
    product: {
      // Variants as dependent
      variants: `
        query getProductVariants($id: ID!) {
          product(id: $id) {
            id
            variants(first: 50) {
              edges {
                node {
                  id
                  title
                  sku
                  price
                  compareAtPrice
                  inventoryQuantity
                  weight
                  weightUnit
                  availableForSale
                  requiresShipping
                  taxable
                  createdAt
                  updatedAt
                  displayName
                  barcode
                  ${options.includeMetafields ? `
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
                  ` : ''}
                  selectedOptions {
                    name
                    value
                  }
                  inventoryItem {
                    id
                    tracked
                    inventoryLevels(first: 5) {
                      edges {
                        node {
                          id
                          available
                          location {
                            id
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
        }
      `,
      // Images as dependent
      images: `
        query getProductImages($id: ID!) {
          product(id: $id) {
            id
            images(first: 50) {
              edges {
                node {
                  id
                  url
                  width
                  height
                  altText
                  createdAt
                  updatedAt
                  ${options.includeMetafields ? `
                  metafields(first: 5) {
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
                  ` : ''}
                }
              }
            }
          }
        }
      `,
      // Metafields as dependent
      metafields: `
        query getProductMetafields($id: ID!) {
          product(id: $id) {
            id
            metafields(first: 50) {
              edges {
                node {
                  id
                  namespace
                  key
                  value
                  type
                  createdAt
                  updatedAt
                  description
                }
              }
            }
          }
        }
      `
    },
    
    // Order as parent
    order: {
      // Line items as dependent
      lineItems: `
        query getOrderLineItems($id: ID!) {
          order(id: $id) {
            id
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
                  discountedUnitPrice {
                    amount
                    currencyCode
                  }
                  variant {
                    id
                    title
                    sku
                    product {
                      id
                      title
                    }
                  }
                  ${options.includeMetafields ? `
                  metafields(first: 5) {
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
                  ` : ''}
                  taxLines {
                    title
                    priceSet {
                      shopMoney {
                        amount
                        currencyCode
                      }
                    }
                    rate
                  }
                  discountAllocations {
                    allocatedAmount {
                      amount
                      currencyCode
                    }
                    discount {
                      ... on DiscountCodeApplication {
                        code
                      }
                      ... on ManualDiscountApplication {
                        title
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `,
      // Fulfillments as dependent
      fulfillments: `
        query getOrderFulfillments($id: ID!) {
          order(id: $id) {
            id
            fulfillments {
              id
              status
              createdAt
              updatedAt
              trackingInfo {
                company
                number
                url
              }
              fulfillmentLineItems(first: 50) {
                edges {
                  node {
                    lineItem {
                      id
                      title
                    }
                    quantity
                  }
                }
              }
              ${options.includeMetafields ? `
              metafields(first: 5) {
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
              ` : ''}
            }
          }
        }
      `,
      // Transactions as dependent
      transactions: `
        query getOrderTransactions($id: ID!) {
          order(id: $id) {
            id
            transactions {
              id
              status
              kind
              gateway
              createdAt
              processedAt
              amountSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              paymentDetails {
                ... on CardPaymentDetails {
                  creditCardCompany
                  creditCardNumber
                }
              }
              ${options.includeMetafields ? `
              metafields(first: 5) {
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
              ` : ''}
            }
          }
        }
      `
    },
    
    // Customer as parent
    customer: {
      // Orders as dependent
      orders: `
        query getCustomerOrders($id: ID!) {
          customer(id: $id) {
            id
            orders(first: 50) {
              edges {
                node {
                  id
                  name
                  processedAt
                  financialStatus
                  fulfillmentStatus
                  totalPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  ${options.includeMetafields ? `
                  metafields(first: 5) {
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
                  ` : ''}
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      `,
      // Addresses as dependent
      addresses: `
        query getCustomerAddresses($id: ID!) {
          customer(id: $id) {
            id
            addresses(first: 50) {
              edges {
                node {
                  id
                  formatted
                  firstName
                  lastName
                  address1
                  address2
                  city
                  province
                  country
                  zip
                  phone
                  company
                  ${options.includeMetafields ? `
                  metafields(first: 5) {
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
                  ` : ''}
                }
              }
            }
          }
        }
      `,
      // Metafields as dependent
      metafields: `
        query getCustomerMetafields($id: ID!) {
          customer(id: $id) {
            id
            metafields(first: 50) {
              edges {
                node {
                  id
                  namespace
                  key
                  value
                  type
                  createdAt
                  updatedAt
                  description
                }
              }
            }
          }
        }
      `
    }
  };
  
  // Return the appropriate query or a default error query
  return queryTemplates[parentType]?.[dependentType] || `
    query notImplemented($id: ID!) {
      __typename
    }
  `;
}

// Main function to extract dependent data
async function extractDependentData(params: DependentQueryParams) {
  const {
    sourceId,
    parentType,
    parentIds,
    dependentType,
    batchSize = 10,
    concurrency = 2,
    options = {}
  } = params;
  
  const extractionStart = Date.now();
  
  // Initialize Supabase client
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  let extractionLogId = options.extractionLogId;
  let logCreated = false;
  
  try {
    // Create extraction log if not provided
    if (!extractionLogId) {
      const { data: logData, error: logError } = await supabase
        .from('extraction_logs')
        .insert({
          dataset_id: 'dependent_extraction',
          status: 'running',
          start_time: new Date().toISOString(),
          metadata: {
            source_id: sourceId,
            parent_type: parentType,
            dependent_type: dependentType,
            parent_ids_count: parentIds.length
          }
        })
        .select()
        .single();
        
      if (logError) throw new Error(`Error creating extraction log: ${logError.message}`);
      
      extractionLogId = logData.id;
      logCreated = true;
    }
    
    // Validate source exists and is connected
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
    
    // Update log with parameters
    await supabase
      .from('extraction_logs')
      .update({
        metadata: {
          source_id: sourceId,
          shop_domain: shopDomain,
          parent_type: parentType,
          dependent_type: dependentType,
          parent_ids_count: parentIds.length,
          batch_size: batchSize,
          concurrency,
          options
        }
      })
      .eq('id', extractionLogId);
    
    // Track overall metrics
    const metrics = {
      totalItems: 0,
      successfulBatches: 0,
      failedBatches: 0,
      apiCalls: 0,
      cacheHits: 0,
      totalRequestTime: 0
    };
    
    // Create results container
    const allResults: Record<string, any[]> = {};
    
    // Create batch processor for concurrent extraction
    const batchProcessor = new BatchProcessor(
      // Extraction function for each parent ID
      async (parentId: string, batchId: number): Promise<BatchExtractionResult> => {
        const startTime = Date.now();
        
        try {
          // Check cache first if enabled
          if (options.cacheResults) {
            const optionsString = JSON.stringify({
              includeMetafields: options.includeMetafields,
              includeImages: options.includeImages,
              includeVariants: options.includeVariants
            });
            
            const cacheKey = DependentQueryCache.generateKey(
              sourceId,
              parentType,
              parentId,
              dependentType,
              optionsString
            );
            
            const cachedData = DependentQueryCache.get(cacheKey);
            
            if (cachedData) {
              console.log(`Cache hit for ${parentType}:${parentId} -> ${dependentType}`);
              
              metrics.cacheHits++;
              
              return {
                success: true,
                data: cachedData,
                batchId,
                parentId,
                metrics: {
                  requestTime: 0,
                  processedCount: cachedData.length,
                  hasMore: false
                }
              };
            }
          }
          
          // Generate the appropriate query
          const query = generateDependentQuery(parentType, dependentType, {
            includeMetafields: options.includeMetafields,
            includeImages: options.includeImages,
            includeVariants: options.includeVariants
          });
          
          if (query.includes('notImplemented')) {
            throw new Error(`Extraction not implemented for ${parentType} -> ${dependentType}`);
          }
          
          // Prepare variables
          const variables = { id: parentId };
          
          // Execute API call
          const response = await fetch(`https://${shopDomain}/admin/api/${apiVersion}/graphql.json`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': accessToken,
              'X-Request-ID': crypto.randomUUID()
            },
            body: JSON.stringify({ query, variables })
          });
          
          // Extract rate limit information
          const rateLimitInfo = {
            available: parseInt(response.headers.get('X-Shopify-Shop-Api-Call-Limit')?.split('/')[0] || '0'),
            maximum: parseInt(response.headers.get('X-Shopify-Shop-Api-Call-Limit')?.split('/')[1] || '0')
          };
          
          // Handle API errors
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error (${response.status}): ${errorText}`);
          }
          
          // Parse response
          const data = await response.json();
          
          // Check for GraphQL errors
          if (data.errors) {
            const errorMessages = data.errors.map((err: any) => err.message).join(', ');
            throw new Error(`GraphQL errors: ${errorMessages}`);
          }
          
          // Extract data based on parent and dependent types
          let extractedItems: any[] = [];
          let hasMore = false;
          let endCursor: string | undefined;
          
          if (data.data) {
            // Navigation based on types
            const parentData = data.data[parentType];
            
            if (!parentData) {
              throw new Error(`No data found for ${parentType} with ID ${parentId}`);
            }
            
            // Extract dependent data
            if (parentData[dependentType]) {
              // Handle cases with connection structure (edges/node)
              if (parentData[dependentType].edges) {
                extractedItems = parentData[dependentType].edges.map((edge: any) => ({
                  ...edge.node,
                  parentId
                }));
                
                // Check for pagination
                if (parentData[dependentType].pageInfo) {
                  hasMore = parentData[dependentType].pageInfo.hasNextPage;
                  endCursor = parentData[dependentType].pageInfo.endCursor;
                }
              } 
              // Handle array results (like fulfillments, transactions)
              else if (Array.isArray(parentData[dependentType])) {
                extractedItems = parentData[dependentType].map((item: any) => ({
                  ...item,
                  parentId
                }));
              }
            }
          }
          
          // Store in cache if enabled
          if (options.cacheResults && extractedItems.length > 0) {
            const optionsString = JSON.stringify({
              includeMetafields: options.includeMetafields,
              includeImages: options.includeImages,
              includeVariants: options.includeVariants
            });
            
            const cacheKey = DependentQueryCache.generateKey(
              sourceId,
              parentType,
              parentId,
              dependentType,
              optionsString
            );
            
            DependentQueryCache.set(cacheKey, extractedItems, (options.cacheTTL || 5) * 60 * 1000);
          }
          
          // Update metrics
          metrics.apiCalls++;
          metrics.totalItems += extractedItems.length;
          metrics.successfulBatches++;
          metrics.totalRequestTime += (Date.now() - startTime);
          
          return {
            success: true,
            data: extractedItems,
            batchId,
            parentId,
            metrics: {
              requestTime: Date.now() - startTime,
              processedCount: extractedItems.length,
              hasMore,
              cursor: endCursor
            }
          };
        } catch (error) {
          console.error(`Error extracting data for ${parentType}:${parentId} -> ${dependentType}:`, error);
          
          // Update metrics
          metrics.failedBatches++;
          
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            batchId,
            parentId,
            metrics: {
              requestTime: Date.now() - startTime,
              processedCount: 0,
              hasMore: false
            }
          };
        }
      },
      concurrency,
      // Callback on batch completion
      async (result: BatchExtractionResult) => {
        // Store successful results
        if (result.success && result.data && result.data.length > 0) {
          if (!allResults[result.parentId!]) {
            allResults[result.parentId!] = [];
          }
          allResults[result.parentId!].push(...result.data);
          
          // Update log periodically
          if (Object.keys(allResults).length % 5 === 0 || 
              metrics.apiCalls % 10 === 0) {
            await updateExtractionLog();
          }
        }
      }
    );
    
    // Queue all parent IDs for processing
    parentIds.forEach((parentId, index) => {
      batchProcessor.addBatch(parentId, index);
    });
    
    // Wait for all batches to complete
    await batchProcessor.waitForCompletion();
    
    // Calculate final metrics
    const totalTime = Date.now() - extractionStart;
    const avgRequestTime = metrics.apiCalls > 0 ? metrics.totalRequestTime / metrics.apiCalls : 0;
    
    // Update extraction log with final results
    await supabase
      .from('extraction_logs')
      .update({
        status: 'completed',
        end_time: new Date().toISOString(),
        records_processed: metrics.totalItems,
        total_records: metrics.totalItems,
        api_calls: metrics.apiCalls,
        average_response_time: avgRequestTime,
        metadata: {
          source_id: sourceId,
          parent_type: parentType,
          dependent_type: dependentType,
          parent_ids_count: parentIds.length,
          successful_parents: Object.keys(allResults).length,
          failed_batches: metrics.failedBatches,
          cache_hits: metrics.cacheHits,
          total_time_ms: totalTime,
          average_request_time_ms: avgRequestTime,
          items_per_second: metrics.totalItems / (totalTime / 1000)
        }
      })
      .eq('id', extractionLogId);
    
    // Return results
    return {
      success: true,
      data: allResults,
      metrics: {
        totalItems: metrics.totalItems,
        successfulBatches: metrics.successfulBatches,
        failedBatches: metrics.failedBatches,
        apiCalls: metrics.apiCalls,
        cacheHits: metrics.cacheHits,
        totalTimeMs: totalTime,
        averageRequestTimeMs: avgRequestTime
      },
      parentCount: parentIds.length,
      successfulParentCount: Object.keys(allResults).length
    };
    
    // Helper function to update log during extraction
    async function updateExtractionLog() {
      await supabase
        .from('extraction_logs')
        .update({
          records_processed: metrics.totalItems,
          api_calls: metrics.apiCalls,
          average_response_time: metrics.apiCalls > 0 ? metrics.totalRequestTime / metrics.apiCalls : 0,
          metadata: {
            status_update_time: new Date().toISOString(),
            processed_parents: Object.keys(allResults).length,
            total_parents: parentIds.length,
            processor_stats: batchProcessor.getStats(),
            cache_hits: metrics.cacheHits,
            elapsed_time_ms: Date.now() - extractionStart
          }
        })
        .eq('id', extractionLogId);
    }
    
  } catch (error) {
    console.error('Error in dependent data extraction:', error);
    
    // Update log with error
    if (extractionLogId) {
      await supabase
        .from('extraction_logs')
        .update({
          status: 'failed',
          end_time: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : String(error),
          metadata: {
            error_details: error instanceof Error ? error.stack : undefined,
            execution_time_ms: Date.now() - extractionStart
          }
        })
        .eq('id', extractionLogId);
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTimeMs: Date.now() - extractionStart
    };
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
    const params = await req.json() as DependentQueryParams;
    
    // Validate required parameters
    if (!params.sourceId || !params.parentType || !params.parentIds || !params.dependentType) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required parameters: sourceId, parentType, parentIds, dependentType',
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
    
    // Limit batch size and concurrency for safety
    if (params.batchSize && (params.batchSize < 1 || params.batchSize > 50)) {
      params.batchSize = Math.max(1, Math.min(50, params.batchSize));
    }
    
    if (params.concurrency && (params.concurrency < 1 || params.concurrency > 5)) {
      params.concurrency = Math.max(1, Math.min(5, params.concurrency));
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
      const result = await extractDependentData(params);
      
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
                        error.message?.includes('in progress') ? 409 : 500;
      
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
