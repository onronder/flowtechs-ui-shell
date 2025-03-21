
import { createClient } from 'https://esm.sh/@supabase/supabase-js@latest';
import { corsHeaders } from '../_shared/cors.ts';

// Define Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Handle OPTIONS requests for CORS
function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  return null;
}

// Simulate various Shopify API responses for testing
async function simulateShopifyResponse(config: {
  // Test configuration
  scenario: string;
  errorRate?: number;
  rateLimitRemaining?: number;
  rateLimitMax?: number;
  latencyMs?: number;
  // Query details
  query?: string;
  variables?: any;
  shopDomain?: string;
}) {
  const {
    scenario,
    errorRate = 0,
    rateLimitRemaining = 1000,
    rateLimitMax = 1000,
    latencyMs = 0,
    query,
    variables,
    shopDomain
  } = config;
  
  // Apply simulated latency
  if (latencyMs > 0) {
    await new Promise(resolve => setTimeout(resolve, latencyMs));
  }
  
  // Base headers included in all responses
  const baseHeaders = {
    'Content-Type': 'application/json',
    'X-Shopify-Shop-Api-Call-Limit': `${rateLimitMax - rateLimitRemaining}/${rateLimitMax}`,
  };
  
  // Apply error rate random chance
  if (errorRate > 0 && Math.random() < errorRate) {
    // Generate a random error scenario
    const errorScenarios = [
      {
        status: 429,
        body: {
          errors: 'Exceeded 2 calls per second for api client. Reduce request rates to resume uninterrupted service.',
        },
        headers: {
          ...baseHeaders,
          'Retry-After': '10',
        }
      },
      {
        status: 500,
        body: {
          errors: 'Internal server error occurred. Please try again later.',
        },
        headers: baseHeaders
      },
      {
        status: 401,
        body: {
          errors: 'Invalid API credentials',
        },
        headers: baseHeaders
      },
      {
        status: 404,
        body: {
          errors: 'Resource not found',
        },
        headers: baseHeaders
      },
      {
        status: 400,
        body: {
          errors: 'Invalid query syntax',
        },
        headers: baseHeaders
      }
    ];
    
    // Select a random error
    const randomError = errorScenarios[Math.floor(Math.random() * errorScenarios.length)];
    
    return {
      status: randomError.status,
      body: randomError.body,
      headers: randomError.headers
    };
  }
  
  // Process based on specific test scenario
  switch (scenario) {
    case 'rate_limit_exceeded':
      return {
        status: 429,
        body: {
          errors: 'Exceeded rate limits for API client',
        },
        headers: {
          ...baseHeaders,
          'X-Shopify-Shop-Api-Call-Limit': `${rateLimitMax}/${rateLimitMax}`,
          'Retry-After': '30',
        }
      };
      
    case 'network_error':
      // Simulate connection drop by not returning anything for a while then error
      await new Promise(resolve => setTimeout(resolve, 5000));
      throw new Error('Network connection timed out');
      
    case 'partial_success':
      // Return some data with warnings
      return {
        status: 200,
        body: {
          data: generateMockShopifyData(query, variables),
          extensions: {
            cost: {
              requestedQueryCost: 256,
              actualQueryCost: 128,
              throttleStatus: {
                maximumAvailable: 1000,
                currentlyAvailable: rateLimitRemaining,
                restoreRate: 50
              }
            }
          },
          warnings: [
            {
              message: "Some requested fields couldn't be retrieved due to access restrictions",
              locations: [{ line: 5, column: 3 }]
            }
          ]
        },
        headers: baseHeaders
      };
      
    case 'data_error':
      // Return null data with errors
      return {
        status: 200,
        body: {
          data: {
            products: null
          },
          errors: [
            {
              message: "Field 'inventory' doesn't exist on type 'Product'",
              locations: [{ line: 10, column: 5 }],
              path: ["products", "edges", "node", "inventory"]
            }
          ],
          extensions: {
            cost: {
              requestedQueryCost: 42,
              actualQueryCost: 0,
              throttleStatus: {
                maximumAvailable: 1000,
                currentlyAvailable: rateLimitRemaining,
                restoreRate: 50
              }
            }
          }
        },
        headers: baseHeaders
      };
      
    case 'timeout':
      // Simulate a timeout by waiting longer than typical timeout values
      await new Promise(resolve => setTimeout(resolve, 60000));
      return {
        status: 200,
        body: { data: generateMockShopifyData(query, variables) },
        headers: baseHeaders
      };
      
    case 'schema_change':
      // Simulate a response with changed schema
      return {
        status: 200,
        body: {
          data: generateMockShopifyDataWithSchemaChanges(query, variables),
          extensions: {
            cost: {
              requestedQueryCost: 56,
              actualQueryCost: 52,
              throttleStatus: {
                maximumAvailable: 1000,
                currentlyAvailable: rateLimitRemaining,
                restoreRate: 50
              }
            }
          }
        },
        headers: baseHeaders
      };
      
    case 'success':
    default:
      // Normal success response
      return {
        status: 200,
        body: {
          data: generateMockShopifyData(query, variables),
          extensions: {
            cost: {
              requestedQueryCost: 56,
              actualQueryCost: 52,
              throttleStatus: {
                maximumAvailable: 1000,
                currentlyAvailable: rateLimitRemaining,
                restoreRate: 50
              }
            }
          }
        },
        headers: baseHeaders
      };
  }
}

// Helper to generate mock Shopify data based on query
function generateMockShopifyData(query?: string, variables?: any): any {
  // Basic mock data structure
  const mockData: Record<string, any> = {};
  
  // Try to determine what the query is asking for
  if (query) {
    if (query.includes('products')) {
      mockData.products = {
        edges: Array.from({ length: 10 }, (_, i) => ({
          node: {
            id: `gid://shopify/Product/${i + 1}`,
            title: `Test Product ${i + 1}`,
            handle: `test-product-${i + 1}`,
            status: "ACTIVE",
            createdAt: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
            updatedAt: new Date(Date.now() - Math.random() * 1000000000).toISOString(),
            description: "This is a test product description",
            descriptionHtml: "<p>This is a test product description</p>",
            totalInventory: Math.floor(Math.random() * 100),
            variants: {
              edges: Array.from({ length: 3 }, (_, j) => ({
                node: {
                  id: `gid://shopify/ProductVariant/${i*10 + j + 1}`,
                  title: `Variant ${j + 1}`,
                  price: (19.99 + j * 5).toString(),
                  sku: `SKU-${i + 1}-${j + 1}`,
                  inventoryQuantity: Math.floor(Math.random() * 50)
                }
              }))
            }
          }
        })),
        pageInfo: {
          hasNextPage: true,
          hasPreviousPage: false,
          startCursor: "cursor1",
          endCursor: "cursor10"
        }
      };
    }
    
    if (query.includes('orders')) {
      mockData.orders = {
        edges: Array.from({ length: 10 }, (_, i) => ({
          node: {
            id: `gid://shopify/Order/${i + 1}`,
            name: `#${1001 + i}`,
            createdAt: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
            processedAt: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
            displayFinancialStatus: ["PAID", "PENDING", "REFUNDED"][Math.floor(Math.random() * 3)],
            displayFulfillmentStatus: ["FULFILLED", "UNFULFILLED", "PARTIALLY_FULFILLED"][Math.floor(Math.random() * 3)],
            totalPriceSet: {
              shopMoney: {
                amount: (99.99 + Math.random() * 200).toFixed(2),
                currencyCode: "USD"
              }
            },
            customer: {
              id: `gid://shopify/Customer/${Math.floor(Math.random() * 100) + 1}`,
              email: `customer${Math.floor(Math.random() * 100) + 1}@example.com`,
              firstName: "Test",
              lastName: "Customer"
            },
            lineItems: {
              edges: Array.from({ length: 2 }, (_, j) => ({
                node: {
                  id: `gid://shopify/LineItem/${i*10 + j + 1}`,
                  title: `Test Line Item ${j + 1}`,
                  quantity: Math.floor(Math.random() * 3) + 1,
                  originalTotalSet: {
                    shopMoney: {
                      amount: (19.99 + j * 5).toFixed(2),
                      currencyCode: "USD"
                    }
                  }
                }
              }))
            }
          }
        })),
        pageInfo: {
          hasNextPage: true,
          hasPreviousPage: false,
          startCursor: "cursor1",
          endCursor: "cursor10"
        }
      };
    }
    
    if (query.includes('customers')) {
      mockData.customers = {
        edges: Array.from({ length: 10 }, (_, i) => ({
          node: {
            id: `gid://shopify/Customer/${i + 1}`,
            email: `customer${i + 1}@example.com`,
            firstName: `First${i + 1}`,
            lastName: `Last${i + 1}`,
            phone: `+1555${String(i).padStart(7, '0')}`,
            createdAt: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
            updatedAt: new Date(Date.now() - Math.random() * 1000000000).toISOString(),
            ordersCount: Math.floor(Math.random() * 10),
            totalSpent: (Math.random() * 1000).toFixed(2)
          }
        })),
        pageInfo: {
          hasNextPage: true,
          hasPreviousPage: false,
          startCursor: "cursor1",
          endCursor: "cursor10"
        }
      };
    }
  }
  
  return mockData;
}

// Helper to generate data with schema changes for testing
function generateMockShopifyDataWithSchemaChanges(query?: string, variables?: any): any {
  const data = generateMockShopifyData(query, variables);
  
  // Introduce schema changes to test adaptation
  if (data.products) {
    // Change field names or structure
    data.products.edges.forEach((edge: any) => {
      // Rename a field
      if (edge.node.totalInventory !== undefined) {
        edge.node.availableInventory = edge.node.totalInventory;
        delete edge.node.totalInventory;
      }
      
      // Add a new field
      edge.node.isGiftCard = false;
      
      // Change a field type
      if (edge.node.status) {
        // Change from string to object with more detail
        const originalStatus = edge.node.status;
        edge.node.status = {
          code: originalStatus,
          active: originalStatus === "ACTIVE",
          lastUpdated: new Date().toISOString()
        };
      }
    });
  }
  
  return data;
}

// Main request handler
Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  
  try {
    // Parse request body
    const requestData = await req.json();
    
    // Log test request for debugging
    console.log("Received test request:", JSON.stringify(requestData, null, 2));
    
    // Simulate Shopify API response based on test configuration
    const response = await simulateShopifyResponse(requestData);
    
    // Return simulated response
    return new Response(
      JSON.stringify(response.body),
      { 
        status: response.status, 
        headers: { ...corsHeaders, ...response.headers }
      }
    );
  } catch (error) {
    console.error('Error in shopify-test-environment:', error);
    
    // Return error response
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
