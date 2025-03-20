
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.5';
import { corsHeaders } from '../_shared/cors.ts';

interface GraphQLRequest {
  query: string;
  variables?: Record<string, any>;
}

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
}

// Sample GraphQL queries for different Shopify entity types
const shopifyQueries = {
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
            shippingAddress {
              address1
              address2
              city
              province
              country
              zip
              phone
            }
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

async function makeShopifyRequest(
  shopDomain: string, 
  accessToken: string, 
  apiVersion: string,
  requestBody: GraphQLRequest,
  circuitBreaker: CircuitBreaker,
  retryCount = 0,
  maxRetries = 3
): Promise<any> {
  // Check circuit breaker
  if (!circuitBreaker.canRequest()) {
    throw new Error("Circuit breaker is open - too many failed requests");
  }
  
  const endpoint = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify(requestBody)
    });
    
    const responseTime = Date.now() - startTime;
    
    // Check for rate limit headers
    const rateLimitInfo = {
      available: parseInt(response.headers.get('X-Shopify-Shop-Api-Call-Limit')?.split('/')[0] || '0'),
      total: parseInt(response.headers.get('X-Shopify-Shop-Api-Call-Limit')?.split('/')[1] || '0')
    };
    
    // Handle various response status codes
    if (response.status === 429) {
      // Rate limited
      if (retryCount < maxRetries) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '1') * 1000;
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        return makeShopifyRequest(shopDomain, accessToken, apiVersion, requestBody, circuitBreaker, retryCount + 1, maxRetries);
      } else {
        circuitBreaker.recordFailure();
        throw new Error("Rate limit exceeded and max retries reached");
      }
    }
    
    if (response.status >= 500) {
      // Server error
      if (retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        return makeShopifyRequest(shopDomain, accessToken, apiVersion, requestBody, circuitBreaker, retryCount + 1, maxRetries);
      } else {
        circuitBreaker.recordFailure();
        throw new Error(`Server error (${response.status}): ${await response.text()}`);
      }
    }
    
    if (response.status >= 400) {
      // Client error
      circuitBreaker.recordFailure();
      const errorData = await response.json();
      throw new Error(`API error (${response.status}): ${JSON.stringify(errorData)}`);
    }
    
    const data = await response.json();
    
    // Check for GraphQL errors
    if (data.errors) {
      circuitBreaker.recordFailure();
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }
    
    // Record success and return data
    circuitBreaker.recordSuccess();
    
    return {
      data: data.data,
      rateLimitInfo,
      responseTime
    };
  } catch (error) {
    // Network or parsing error
    if (retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
      return makeShopifyRequest(shopDomain, accessToken, apiVersion, requestBody, circuitBreaker, retryCount + 1, maxRetries);
    }
    
    circuitBreaker.recordFailure();
    throw error;
  }
}

async function extractShopifyData(params: ExtractParams) {
  const { sourceId, datasetId, queryType, queryName, queryDetails, extractionLogId, cursor, sampleOnly } = params;
  
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
    
    // Validate and get the query
    if (!shopifyQueries[queryName as keyof typeof shopifyQueries]) {
      throw new Error(`Unknown query name: ${queryName}`);
    }
    
    const query = shopifyQueries[queryName as keyof typeof shopifyQueries];
    
    // Setup circuit breaker
    const extractionSettings = await getExtractionSettings(supabase, datasetId);
    const circuitBreaker = new CircuitBreaker(
      extractionSettings.circuit_breaker_threshold || 5,
      30000
    );
    
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
    
    // Execute the query
    const result = await makeShopifyRequest(
      shopDomain,
      accessToken,
      apiVersion,
      { query, variables },
      circuitBreaker,
      0,
      extractionSettings.max_retries || 3
    );
    
    // Get data and page info
    const entityData = result.data[queryName];
    const hasNextPage = entityData.pageInfo.hasNextPage;
    const nextCursor = entityData.pageInfo.endCursor;
    
    // Process the items
    const items = entityData.edges.map((edge: any) => edge.node);
    
    // Update extraction log with progress
    await updateExtractionLog(supabase, extractionLogId, {
      api_calls: 1,
      records_processed: items.length,
      average_response_time: result.responseTime,
      metadata: {
        rate_limit: result.rateLimitInfo,
        execution_step: cursor ? 'pagination' : 'initial',
        cursor: nextCursor
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
      sample: items.slice(0, 10) // Return first 10 for preview
    };
  } catch (error) {
    console.error('Error in extraction:', error);
    
    // Update extraction log with error
    await updateExtractionLogError(
      supabase, 
      extractionLogId, 
      error instanceof Error ? error.message : String(error)
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
  }
}

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
      timeout_seconds: 30
    };
  } catch (error) {
    console.error('Error getting extraction settings:', error);
    
    // Return defaults
    return {
      batch_size: 100,
      max_retries: 3,
      throttle_delay_ms: 1000,
      circuit_breaker_threshold: 5,
      timeout_seconds: 30
    };
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

async function updateExtractionLogError(supabase: any, logId: string, errorMessage: string) {
  try {
    const { error } = await supabase
      .from('extraction_logs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        end_time: new Date().toISOString()
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
      updates.data = null;
      updates.status = 'ready';
      updates.last_error_details = null;
    }
    
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
  
  try {
    const params = await req.json() as ExtractParams;
    
    if (!params.sourceId || !params.datasetId || !params.queryType || !params.queryName) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    const result = await extractShopifyData(params);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
