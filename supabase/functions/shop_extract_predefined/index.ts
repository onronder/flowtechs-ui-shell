
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.5';
import { corsHeaders } from '../_shared/cors.ts';

interface ExtractionParams {
  sourceId: string;
  datasetId: string;
  queryType: 'product' | 'order' | 'customer' | 'inventory' | 'collection';
  queryName: string;
  queryDetails: {
    include_variants?: boolean;
    include_images?: boolean;
    include_metafields?: boolean;
    include_line_items?: boolean;
    include_fulfillments?: boolean;
    include_addresses?: boolean;
    date_range?: string;
    batch_size?: number;
    max_retries?: number;
    throttle_delay_ms?: number;
    circuit_breaker_threshold?: number;
    timeout_seconds?: number;
    concurrent_requests?: number;
    deduplication_enabled?: boolean;
    cache_enabled?: boolean;
    field_optimization?: boolean;
  };
  extractionLogId?: string;
  sampleOnly?: boolean;
}

interface GraphQLResult {
  data: any;
  pageInfo?: {
    hasNextPage: boolean;
    endCursor?: string;
  };
  errors?: any[];
  extensions?: any;
}

interface ExtractionResult {
  success: boolean;
  data?: any[];
  sample?: any[];
  recordCount?: number;
  error?: string;
  extractionTime?: number;
  apiCalls?: number;
  averageResponseTime?: number;
  rateLimitInfo?: {
    available: number;
    maximum: number;
    restoreRate: number;
    requestCost: number;
  };
}

interface DateFilter {
  field: string;
  from?: string;
  to?: string;
}

// Define predefined queries
const PREDEFINED_QUERIES = {
  products: `
    query GetProducts($cursor: String, $pageSize: Int!, $metafieldIncluded: Boolean!, $variantsIncluded: Boolean!, $imagesIncluded: Boolean!, $sortKey: ProductSortKeys) {
      products(first: $pageSize, after: $cursor, sortKey: $sortKey) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            title
            description
            handle
            productType
            tags
            vendor
            status
            publishedAt
            createdAt
            updatedAt
            onlineStoreUrl
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
            totalInventory
            metafields @include(if: $metafieldIncluded) {
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
            images @include(if: $imagesIncluded) {
              edges {
                node {
                  id
                  altText
                  src
                  width
                  height
                }
              }
            }
            variants @include(if: $variantsIncluded) {
              edges {
                node {
                  id
                  title
                  sku
                  price
                  compareAtPrice
                  inventoryQuantity
                  inventoryPolicy
                  barcode
                  availableForSale
                  position
                  createdAt
                  updatedAt
                  weight
                  weightUnit
                }
              }
            }
          }
        }
      }
    }
  `,
  orders: `
    query GetOrders($cursor: String, $pageSize: Int!, $lineItemsIncluded: Boolean!, $fulfillmentsIncluded: Boolean!, $sinceDate: DateTime, $sortKey: OrderSortKeys) {
      orders(first: $pageSize, after: $cursor, query: $sinceDate, sortKey: $sortKey) {
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
            confirmed
            cancelledAt
            cancelReason
            createdAt
            updatedAt
            processedAt
            closedAt
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            subtotalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            totalShippingPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            totalTaxSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            financialStatus
            fulfillmentStatus
            customer {
              id
              email
              firstName
              lastName
              ordersCount
              totalSpent
            }
            shippingAddress {
              firstName
              lastName
              address1
              address2
              city
              provinceCode
              countryCodeV2
              zip
              phone
            }
            billingAddress {
              firstName
              lastName
              address1
              address2
              city
              provinceCode
              countryCodeV2
              zip
              phone
            }
            lineItems @include(if: $lineItemsIncluded) {
              edges {
                node {
                  id
                  title
                  quantity
                  originalTotalSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  discountedTotalSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  variant {
                    id
                    title
                    sku
                    price
                    product {
                      id
                      title
                      handle
                    }
                  }
                }
              }
            }
            fulfillments @include(if: $fulfillmentsIncluded) {
              id
              status
              trackingInfo {
                company
                number
                url
              }
              createdAt
              updatedAt
            }
          }
        }
      }
    }
  `,
  customers: `
    query GetCustomers($cursor: String, $pageSize: Int!, $addressesIncluded: Boolean!, $sortKey: CustomerSortKeys) {
      customers(first: $pageSize, after: $cursor, sortKey: $sortKey) {
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
            tags
            createdAt
            updatedAt
            ordersCount
            totalSpent
            note
            state
            defaultAddress {
              address1
              address2
              city
              provinceCode
              countryCodeV2
              zip
              phone
            }
            addresses @include(if: $addressesIncluded) {
              address1
              address2
              city
              provinceCode
              countryCodeV2
              zip
              phone
            }
          }
        }
      }
    }
  `,
  inventory: `
    query GetInventory($cursor: String, $pageSize: Int!) {
      locations(first: 10) {
        edges {
          node {
            id
            name
            isActive
            address {
              address1
              address2
              city
              provinceCode
              countryCode
              zip
            }
            inventoryLevels(first: $pageSize, after: $cursor) {
              pageInfo {
                hasNextPage
                endCursor
              }
              edges {
                node {
                  id
                  available
                  item {
                    __typename
                    ... on InventoryItem {
                      id
                      sku
                      tracked
                      createdAt
                      updatedAt
                      variant {
                        id
                        title
                        product {
                          id
                          title
                          handle
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
    }
  `,
  collections: `
    query GetCollections($cursor: String, $pageSize: Int!, $sortKey: CollectionSortKeys) {
      collections(first: $pageSize, after: $cursor, sortKey: $sortKey) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            title
            description
            handle
            descriptionHtml
            updatedAt
            productsCount
            seo {
              title
              description
            }
            image {
              id
              altText
              src
              width
              height
            }
          }
        }
      }
    }
  `
};

// Create date filter based on date range
function createDateFilter(queryType: string, dateRange?: string): DateFilter | null {
  if (!dateRange) return null;
  
  const now = new Date();
  let fromDate: Date | null = null;
  
  switch (dateRange) {
    case '30d':
      fromDate = new Date(now);
      fromDate.setDate(now.getDate() - 30);
      break;
    case '90d':
      fromDate = new Date(now);
      fromDate.setDate(now.getDate() - 90);
      break;
    case 'ytd':
      fromDate = new Date(now.getFullYear(), 0, 1); // Start of this year
      break;
    case 'all':
      // No date filter
      return null;
    default:
      // No recognized date range
      return null;
  }
  
  let field = '';
  switch (queryType) {
    case 'orders':
      field = 'created_at';
      break;
    case 'customers':
      field = 'created_at';
      break;
    case 'products':
      field = 'updated_at';
      break;
    default:
      // No date field for this query type
      return null;
  }
  
  return {
    field,
    from: fromDate ? fromDate.toISOString() : undefined
  };
}

// Format query parameters
function getQueryVariables(queryType: string, queryDetails: any, pageSize: number, cursor?: string): Record<string, any> {
  const variables: Record<string, any> = {
    pageSize,
    cursor: cursor || null
  };
  
  switch (queryType) {
    case 'products':
      variables.metafieldIncluded = !!queryDetails.include_metafields;
      variables.variantsIncluded = !!queryDetails.include_variants;
      variables.imagesIncluded = !!queryDetails.include_images;
      variables.sortKey = 'UPDATED_AT';
      break;
    case 'orders':
      variables.lineItemsIncluded = !!queryDetails.include_line_items;
      variables.fulfillmentsIncluded = !!queryDetails.include_fulfillments;
      variables.sortKey = 'PROCESSED_AT';
      
      // Handle date filtering
      if (queryDetails.date_range && queryDetails.date_range !== 'all') {
        const fromDate = new Date();
        switch (queryDetails.date_range) {
          case '30d':
            fromDate.setDate(fromDate.getDate() - 30);
            break;
          case '90d':
            fromDate.setDate(fromDate.getDate() - 90);
            break;
          default:
            // Default to 30 days
            fromDate.setDate(fromDate.getDate() - 30);
        }
        variables.sinceDate = fromDate.toISOString();
      }
      break;
    case 'customers':
      variables.addressesIncluded = !!queryDetails.include_addresses;
      variables.sortKey = 'UPDATED_AT';
      break;
    case 'inventory':
      // No special variables
      break;
    case 'collections':
      variables.sortKey = 'UPDATED_AT';
      break;
  }
  
  return variables;
}

// Normalize query results
function normalizeQueryResults(queryType: string, data: any): any[] {
  try {
    let items: any[] = [];
    let pageInfo = null;
    
    switch (queryType) {
      case 'products':
        items = data.products.edges.map((edge: any) => {
          const node = edge.node;
          
          // Normalize nested arrays
          if (node.metafields?.edges) {
            node.metafields = node.metafields.edges.map((e: any) => e.node);
          }
          
          if (node.images?.edges) {
            node.images = node.images.edges.map((e: any) => e.node);
          }
          
          if (node.variants?.edges) {
            node.variants = node.variants.edges.map((e: any) => e.node);
          }
          
          return node;
        });
        pageInfo = data.products.pageInfo;
        break;
      case 'orders':
        items = data.orders.edges.map((edge: any) => {
          const node = edge.node;
          
          // Normalize nested arrays
          if (node.lineItems?.edges) {
            node.lineItems = node.lineItems.edges.map((e: any) => e.node);
          }
          
          return node;
        });
        pageInfo = data.orders.pageInfo;
        break;
      case 'customers':
        items = data.customers.edges.map((edge: any) => edge.node);
        pageInfo = data.customers.pageInfo;
        break;
      case 'inventory':
        // Inventory is more nested - we need to flatten location -> inventoryLevels
        const inventoryItems: any[] = [];
        
        data.locations.edges.forEach((locationEdge: any) => {
          const location = locationEdge.node;
          
          location.inventoryLevels.edges.forEach((inventoryEdge: any) => {
            const inventory = inventoryEdge.node;
            inventoryItems.push({
              ...inventory,
              locationId: location.id,
              locationName: location.name,
              locationAddress: location.address
            });
          });
          
          // Use the pageInfo from the first location's inventory levels
          if (!pageInfo && location.inventoryLevels.pageInfo) {
            pageInfo = location.inventoryLevels.pageInfo;
          }
        });
        
        items = inventoryItems;
        break;
      case 'collections':
        items = data.collections.edges.map((edge: any) => edge.node);
        pageInfo = data.collections.pageInfo;
        break;
    }
    
    return { items, pageInfo };
  } catch (error) {
    console.error(`Error normalizing ${queryType} data:`, error);
    throw new Error(`Failed to normalize data: ${error.message}`);
  }
}

// Function to execute query with pagination
async function executeQueryWithPagination(
  shopDomain: string,
  accessToken: string,
  apiVersion: string,
  queryType: string,
  queryDetails: any,
  sampleOnly: boolean = false,
  extractionLogId?: string,
  maxRecords: number = 1000
): Promise<{ data: any[], apiCalls: number, averageResponseTime: number }> {
  const endpoint = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;
  const query = PREDEFINED_QUERIES[queryType as keyof typeof PREDEFINED_QUERIES];
  
  if (!query) {
    throw new Error(`No predefined query available for type: ${queryType}`);
  }
  
  const batchSize = queryDetails.batch_size || 100;
  const maxRetries = queryDetails.max_retries || 3;
  const throttleDelay = queryDetails.throttle_delay_ms || 500;
  
  let hasNextPage = true;
  let cursor: string | null = null;
  let allResults: any[] = [];
  let apiCalls = 0;
  let totalResponseTime = 0;
  
  // If sampleOnly, just get one page of results
  const recordLimit = sampleOnly ? Math.min(batchSize, 10) : maxRecords;
  
  while (hasNextPage && allResults.length < recordLimit) {
    apiCalls++;
    
    // Add variable delay for rate limiting protection
    if (apiCalls > 1) {
      await new Promise(resolve => setTimeout(resolve, throttleDelay + Math.random() * 200));
    }
    
    const variables = getQueryVariables(queryType, queryDetails, batchSize, cursor);
    
    // Execute with retries
    let retries = 0;
    let success = false;
    let result = null;
    
    while (!success && retries <= maxRetries) {
      try {
        const startTime = Date.now();
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken
          },
          body: JSON.stringify({
            query,
            variables
          })
        });
        
        const responseTime = Date.now() - startTime;
        totalResponseTime += responseTime;
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`GraphQL request failed: ${response.status} ${errorText}`);
        }
        
        result = await response.json();
        
        // Check for GraphQL errors
        if (result.errors) {
          throw new Error(`GraphQL errors: ${result.errors.map((e: any) => e.message).join(', ')}`);
        }
        
        success = true;
      } catch (error) {
        retries++;
        
        if (retries > maxRetries) {
          throw new Error(`Failed after ${maxRetries} retries: ${error.message}`);
        }
        
        // Exponential backoff with jitter
        const delay = Math.pow(2, retries) * 1000 + Math.random() * 1000;
        console.log(`Retry ${retries}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Process results
    const normalized = normalizeQueryResults(queryType, result.data);
    allResults = [...allResults, ...normalized.items];
    
    // Update extraction log if provided
    if (extractionLogId) {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
      const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      await supabase
        .from('extraction_logs')
        .update({
          records_processed: allResults.length,
          api_calls: apiCalls,
          average_response_time: totalResponseTime / apiCalls,
          metadata: {
            last_cursor: cursor,
            has_more: normalized.pageInfo?.hasNextPage,
            current_batch: apiCalls,
            query_type: queryType,
            timestamp: new Date().toISOString()
          }
        })
        .eq('id', extractionLogId);
    }
    
    // Update pagination info for next request
    hasNextPage = normalized.pageInfo?.hasNextPage || false;
    cursor = normalized.pageInfo?.endCursor || null;
    
    // If sample only, we're done after first batch
    if (sampleOnly) {
      break;
    }
  }
  
  return {
    data: allResults,
    apiCalls,
    averageResponseTime: apiCalls > 0 ? totalResponseTime / apiCalls : 0
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
    const params = await req.json() as ExtractionParams;
    
    if (!params.sourceId || !params.queryType) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters: sourceId and queryType are required',
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
    
    // Validate authentication token
    const authHeader = req.headers.get('Authorization');
    let userId = '';
    
    if (authHeader) {
      // Extract user ID from the JWT
      try {
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
    
    const shopDomain = source.store_name || '';
    const accessToken = tokenData;
    const apiVersion = source.api_version || '2024-04';
    
    // Create extraction log if not provided
    let extractionLogId = params.extractionLogId;
    
    if (!params.sampleOnly && !extractionLogId) {
      const { data: logData, error: logError } = await supabase
        .from('extraction_logs')
        .insert({
          dataset_id: params.datasetId,
          status: 'running',
          metadata: {
            query_type: params.queryType,
            query_name: params.queryName,
            query_details: params.queryDetails,
            timestamp: new Date().toISOString()
          }
        })
        .select()
        .single();
        
      if (logError) {
        console.error('Error creating extraction log:', logError);
      } else {
        extractionLogId = logData.id;
      }
    }
    
    try {
      // Execute query with pagination
      const { data, apiCalls, averageResponseTime } = await executeQueryWithPagination(
        shopDomain,
        accessToken,
        apiVersion,
        params.queryName,
        params.queryDetails,
        params.sampleOnly,
        extractionLogId
      );
      
      // If not just a sample, update the dataset with the results
      if (!params.sampleOnly) {
        const { error: updateError } = await supabase
          .from('datasets')
          .update({
            data: data,
            status: 'completed',
            record_count: data.length,
            data_updated_at: new Date().toISOString(),
            extraction_progress: 100,
            last_completed_run: new Date().toISOString(),
            last_run_duration: Date.now() - requestStart,
            error_message: null
          })
          .eq('id', params.datasetId);
          
        if (updateError) {
          console.error('Error updating dataset:', updateError);
        }
        
        // Update extraction log
        if (extractionLogId) {
          await supabase
            .from('extraction_logs')
            .update({
              end_time: new Date().toISOString(),
              status: 'completed',
              records_processed: data.length,
              total_records: data.length,
              api_calls: apiCalls,
              average_response_time: averageResponseTime,
              metadata: {
                query_type: params.queryType,
                query_name: params.queryName,
                execution_time_ms: Date.now() - requestStart,
                record_count: data.length,
                api_calls: apiCalls,
                timestamp: new Date().toISOString()
              }
            })
            .eq('id', extractionLogId);
        }
      }
      
      // Create audit log
      await supabase
        .from('audit_logs')
        .insert({
          table_name: 'extraction_logs',
          record_id: params.datasetId,
          action: 'EXTRACTION_COMPLETE',
          user_id: userId,
          new_data: {
            execution_time_ms: Date.now() - requestStart,
            records_processed: data.length,
            api_calls: apiCalls,
            average_response_time: averageResponseTime,
            sample_only: params.sampleOnly,
            timestamp: new Date().toISOString(),
            request_id: requestId
          },
        });
      
      // Return success response
      return new Response(
        JSON.stringify({
          success: true,
          sample: params.sampleOnly ? data.slice(0, 10) : undefined,
          recordCount: data.length,
          extractionTime: Date.now() - requestStart,
          apiCalls,
          averageResponseTime,
          requestId
        } as ExtractionResult),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
            'X-Execution-Time': (Date.now() - requestStart).toString()
          } 
        }
      );
    } catch (error) {
      console.error('Error executing extraction:', error);
      
      // Update dataset with error if not sample
      if (!params.sampleOnly) {
        await supabase
          .from('datasets')
          .update({
            status: 'failed',
            error_message: error.message || 'Unknown error during extraction',
            last_run_duration: Date.now() - requestStart,
            last_error_details: {
              error: error.message || 'Unknown error',
              timestamp: new Date().toISOString(),
              stack: error.stack,
              request_id: requestId
            }
          })
          .eq('id', params.datasetId);
          
        // Update extraction log
        if (extractionLogId) {
          await supabase
            .from('extraction_logs')
            .update({
              end_time: new Date().toISOString(),
              status: 'failed',
              error_message: error.message || 'Unknown error',
              metadata: {
                error: error.message || 'Unknown error',
                timestamp: new Date().toISOString(),
                request_id: requestId
              }
            })
            .eq('id', extractionLogId);
        }
      }
      
      // Create audit log for error
      await supabase
        .from('audit_logs')
        .insert({
          table_name: 'extraction_logs',
          record_id: params.datasetId,
          action: 'EXTRACTION_ERROR',
          user_id: userId,
          new_data: {
            error: error.message || 'Unknown error',
            execution_time_ms: Date.now() - requestStart,
            sample_only: params.sampleOnly,
            timestamp: new Date().toISOString(),
            request_id: requestId
          },
        });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error instanceof Error ? error.message : String(error),
          requestId,
          executionTime: Date.now() - requestStart
        }),
        { 
          status: 500, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
            'X-Execution-Time': (Date.now() - requestStart).toString()
          } 
        }
      );
    }
  } catch (error) {
    // Handle request parsing errors
    console.error('Request parsing error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Invalid request format',
        details: error instanceof Error ? error.message : String(error),
        requestId,
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
