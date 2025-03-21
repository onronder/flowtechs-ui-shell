
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

// Define interface for scope permissions
interface ScopePermission {
  handle: string;
  access: 'read' | 'write' | 'read_write';
}

// Define interface for test results
interface TestResult {
  success: boolean;
  error?: string;
  name: string;
  category: string;
  details?: Record<string, any>;
}

// Custom exponential backoff logic for retries
async function retryWithBackoff(operation: () => Promise<Response>, maxRetries: number): Promise<Response> {
  let retries = 0;
  
  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (retries >= maxRetries) {
        throw error;
      }
      
      // Calculate exponential delay with some randomization
      const delay = Math.min(1000 * 2 ** retries + Math.random() * 1000, 10000);
      
      console.log(`Retry attempt ${retries + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      retries++;
    }
  }
}

// Decrypt and retrieve the source connection details
async function getSourceDetails(sourceId: string) {
  // Get source record
  const { data: source, error: sourceError } = await supabase
    .from('sources')
    .select('*')
    .eq('id', sourceId)
    .eq('type', 'shopify')
    .single();
  
  if (sourceError) {
    throw new Error(`Error fetching source: ${sourceError.message}`);
  }
  
  if (!source) {
    throw new Error('Source not found');
  }
  
  // Decrypt access token using database function
  const { data: tokenData, error: tokenError } = await supabase.rpc(
    'decrypt_access_token',
    { encrypted_token: source.access_token, user_uuid: source.user_id }
  );
  
  if (tokenError) {
    throw new Error(`Error decrypting token: ${tokenError.message}`);
  }
  
  // Get additional credentials from the metadata
  let storeUrl = '';
  
  if (source.metadata) {
    const metadata = source.metadata as Record<string, any>;
    
    if (metadata.store_url) {
      storeUrl = metadata.store_url;
    }
  }
  
  if (!source.store_name) {
    throw new Error('Store name is missing');
  }
  
  // Construct the store URL if we don't have it from metadata
  if (!storeUrl) {
    storeUrl = `https://${source.store_name}.myshopify.com`;
  }
  
  // Clean URL format
  if (!storeUrl.startsWith('https://')) {
    storeUrl = `https://${storeUrl}`;
  }
  
  // Remove trailing slash if present
  if (storeUrl.endsWith('/')) {
    storeUrl = storeUrl.slice(0, -1);
  }
  
  return {
    id: source.id,
    name: source.name,
    store_url: storeUrl,
    store_name: source.store_name,
    access_token: tokenData,
    api_version: source.api_version || '2024-04',
    connection_timeout: (source.metadata as any)?.connection_timeout || 30,
    max_retries: (source.metadata as any)?.max_retries || 3,
    throttle_rate: (source.metadata as any)?.throttle_rate || 2,
    custom_headers: (source.metadata as any)?.custom_headers || {},
  };
}

// Test basic shop connectivity
async function testShopConnectivity(sourceDetails: any): Promise<TestResult> {
  const shopApiUrl = `${sourceDetails.store_url}/admin/api/${sourceDetails.api_version}/shop.json`;
  
  const headers = {
    'X-Shopify-Access-Token': sourceDetails.access_token,
    'Content-Type': 'application/json',
    ...sourceDetails.custom_headers,
  };
  
  try {
    const response = await retryWithBackoff(
      () => fetch(shopApiUrl, {
        method: 'GET',
        headers,
      }),
      sourceDetails.max_retries
    );
    
    // Handle non-success responses
    if (!response.ok) {
      const statusText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${statusText}`,
        name: 'Basic Connectivity',
        category: 'Connectivity',
        details: {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
        },
      };
    }
    
    const shopData = await response.json();
    
    return {
      success: true,
      name: 'Basic Connectivity',
      category: 'Connectivity',
      details: {
        shop: shopData.shop.name,
        domain: shopData.shop.myshopify_domain,
        plan: shopData.shop.plan_name,
        status: response.status,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      name: 'Basic Connectivity',
      category: 'Connectivity',
    };
  }
}

// Test GraphQL connectivity
async function testGraphQLConnectivity(sourceDetails: any): Promise<TestResult> {
  const graphqlUrl = `${sourceDetails.store_url}/admin/api/${sourceDetails.api_version}/graphql.json`;
  
  const headers = {
    'X-Shopify-Access-Token': sourceDetails.access_token,
    'Content-Type': 'application/json',
    ...sourceDetails.custom_headers,
  };
  
  // Simple introspection query to verify GraphQL endpoint
  const query = `{
    shop {
      name
      id
    }
  }`;
  
  try {
    const response = await retryWithBackoff(
      () => fetch(graphqlUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query }),
      }),
      sourceDetails.max_retries
    );
    
    // Extract rate limits
    const rateLimitHeader = response.headers.get('X-Shopify-Shop-Api-Call-Limit');
    const rateLimit = rateLimitHeader ? {
      available: parseInt(rateLimitHeader.split('/')[0]),
      maximum: parseInt(rateLimitHeader.split('/')[1]),
    } : null;
    
    // Handle non-success responses
    if (!response.ok) {
      const statusText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${statusText}`,
        name: 'GraphQL API Access',
        category: 'Connectivity',
        details: {
          status: response.status,
          rateLimit,
          headers: Object.fromEntries(response.headers.entries()),
        },
      };
    }
    
    const responseData = await response.json();
    
    // Check for GraphQL errors
    if (responseData.errors) {
      return {
        success: false,
        error: responseData.errors[0].message,
        name: 'GraphQL API Access',
        category: 'Connectivity',
        details: {
          errors: responseData.errors,
          rateLimit,
        },
      };
    }
    
    return {
      success: true,
      name: 'GraphQL API Access',
      category: 'Connectivity',
      details: {
        shop: responseData.data.shop.name,
        shopId: responseData.data.shop.id,
        rateLimit,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      name: 'GraphQL API Access',
      category: 'Connectivity',
    };
  }
}

// Test rate limit detection
async function testRateLimits(sourceDetails: any): Promise<TestResult> {
  // This test piggybacks on the GraphQL test since we already have rate limit info from there
  const graphqlUrl = `${sourceDetails.store_url}/admin/api/${sourceDetails.api_version}/graphql.json`;
  
  const headers = {
    'X-Shopify-Access-Token': sourceDetails.access_token,
    'Content-Type': 'application/json',
    ...sourceDetails.custom_headers,
  };
  
  // Simple query to check rate limits
  const query = `{
    shop {
      name
    }
  }`;
  
  try {
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
    });
    
    // Extract rate limits
    const rateLimitHeader = response.headers.get('X-Shopify-Shop-Api-Call-Limit');
    let rateLimit = null;
    
    if (rateLimitHeader) {
      const [used, total] = rateLimitHeader.split('/').map(Number);
      rateLimit = {
        used,
        available: total - used,
        maximum: total,
        percentUsed: (used / total) * 100,
      };
    }
    
    if (!rateLimit) {
      return {
        success: false,
        error: 'Could not detect rate limit information',
        name: 'Rate Limit Detection',
        category: 'Capacity',
      };
    }
    
    // Check if we're close to rate limits
    const isApproachingLimit = rateLimit.percentUsed > 80;
    
    return {
      success: true,
      name: 'Rate Limit Detection',
      category: 'Capacity',
      details: {
        rateLimit,
        warning: isApproachingLimit ? 'Approaching rate limit threshold' : null,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      name: 'Rate Limit Detection',
      category: 'Capacity',
    };
  }
}

// Test API version compatibility
async function testAPIVersionCompatibility(sourceDetails: any): Promise<TestResult> {
  // Current and previous API versions to check against
  const currentVersions = ['2024-04', '2024-01', '2023-10'];
  const apiVersion = sourceDetails.api_version;
  
  if (!currentVersions.includes(apiVersion)) {
    return {
      success: false,
      error: `Using outdated API version: ${apiVersion}`,
      name: 'API Version Compatibility',
      category: 'Configuration',
      details: {
        currentVersion: apiVersion,
        recommendedVersions: currentVersions,
        isOutdated: true,
      },
    };
  }
  
  return {
    success: true,
    name: 'API Version Compatibility',
    category: 'Configuration',
    details: {
      currentVersion: apiVersion,
      recommendedVersions: currentVersions,
      isLatest: apiVersion === currentVersions[0],
    },
  };
}

// Test permission scopes
async function testPermissionScopes(sourceDetails: any): Promise<TestResult> {
  // We'll run a series of test queries that require different permissions
  const testQueries = [
    {
      name: 'Products Read',
      query: `{
        products(first: 1) {
          edges {
            node {
              id
              title
            }
          }
        }
      }`,
      requiredScope: 'read_products'
    },
    {
      name: 'Orders Read',
      query: `{
        orders(first: 1) {
          edges {
            node {
              id
              name
            }
          }
        }
      }`,
      requiredScope: 'read_orders'
    },
    {
      name: 'Customers Read',
      query: `{
        customers(first: 1) {
          edges {
            node {
              id
              displayName
            }
          }
        }
      }`,
      requiredScope: 'read_customers'
    }
  ];
  
  const graphqlUrl = `${sourceDetails.store_url}/admin/api/${sourceDetails.api_version}/graphql.json`;
  
  const headers = {
    'X-Shopify-Access-Token': sourceDetails.access_token,
    'Content-Type': 'application/json',
    ...sourceDetails.custom_headers,
  };
  
  const results = [];
  
  for (const test of testQueries) {
    try {
      const response = await fetch(graphqlUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: test.query }),
      });
      
      const data = await response.json();
      
      const hasPermission = !data.errors || !data.errors.some(e => 
        e.message.includes('Access denied') || 
        e.message.includes('unauthorized')
      );
      
      results.push({
        name: test.name,
        scope: test.requiredScope,
        hasPermission,
        errors: data.errors,
      });
    } catch (error) {
      results.push({
        name: test.name,
        scope: test.requiredScope,
        hasPermission: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  const missingPermissions = results.filter(r => !r.hasPermission);
  
  if (missingPermissions.length > 0) {
    return {
      success: false,
      error: `Missing required permissions: ${missingPermissions.map(p => p.scope).join(', ')}`,
      name: 'Permission Scopes',
      category: 'Authorization',
      details: {
        results,
        missingScopes: missingPermissions.map(p => p.scope),
      },
    };
  }
  
  return {
    success: true,
    name: 'Permission Scopes',
    category: 'Authorization',
    details: {
      results,
      availableScopes: results.map(r => r.scope),
    },
  };
}

// Run a comprehensive Shopify connection test
async function runAdvancedConnectionTest(sourceId: string) {
  try {
    // Get source details
    const sourceDetails = await getSourceDetails(sourceId);
    
    // Log test start
    await logConnectionTest(sourceId, 'advanced_test_start', { 
      timestamp: new Date().toISOString(),
      source_name: sourceDetails.name,
    });
    
    // Run all tests concurrently
    const testResults = await Promise.all([
      testShopConnectivity(sourceDetails),
      testGraphQLConnectivity(sourceDetails),
      testRateLimits(sourceDetails),
      testAPIVersionCompatibility(sourceDetails),
      testPermissionScopes(sourceDetails),
    ]);
    
    // Analyze results
    const failedTests = testResults.filter(test => !test.success);
    const categorizedResults = testResults.reduce((acc, test) => {
      if (!acc[test.category]) {
        acc[test.category] = [];
      }
      acc[test.category].push(test);
      return acc;
    }, {} as Record<string, TestResult[]>);
    
    const overallSuccess = failedTests.length === 0;
    
    // Generate summary message
    let summaryMessage = '';
    
    if (overallSuccess) {
      summaryMessage = `All connection tests passed successfully for ${sourceDetails.name}`;
    } else {
      const failureCategories = [...new Set(failedTests.map(t => t.category))];
      summaryMessage = `Connection issues detected in: ${failureCategories.join(', ')}`;
    }
    
    // Update source connection status based on test results
    await updateConnectionStatus(sourceId, overallSuccess);
    
    // Log test completion
    await logConnectionTest(sourceId, overallSuccess ? 'advanced_test_success' : 'advanced_test_failure', {
      timestamp: new Date().toISOString(),
      summary: summaryMessage,
      failed_tests: failedTests.length,
      total_tests: testResults.length,
    });
    
    return {
      success: overallSuccess,
      message: summaryMessage,
      categories: categorizedResults,
      tests: testResults,
    };
  } catch (error) {
    // Log test error
    await logConnectionTest(sourceId, 'advanced_test_error', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
    
    throw error;
  }
}

// Update source connection status based on test results
async function updateConnectionStatus(sourceId: string, isConnected: boolean) {
  const status = isConnected ? 'connected' : 'error';
  const errorMessage = isConnected ? null : 'Failed advanced connection test';
  
  try {
    // Update source record
    const { error } = await supabase
      .from('sources')
      .update({
        connection_status: status,
        connection_error: errorMessage,
        last_connected_at: isConnected ? new Date().toISOString() : undefined,
      })
      .eq('id', sourceId);
    
    if (error) {
      console.error('Error updating source status:', error);
    }
  } catch (error) {
    console.error('Error in updateConnectionStatus:', error);
  }
}

// Log connection test to the audit_logs table
async function logConnectionTest(
  sourceId: string,
  action: string,
  metadata: Record<string, any> = {}
) {
  try {
    // Get source name for logging
    const { data: source } = await supabase
      .from('sources')
      .select('name')
      .eq('id', sourceId)
      .single();
    
    // Insert connection log
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'connection_logs',
        record_id: sourceId,
        action: `connection:${action}`,
        user_id: '00000000-0000-0000-0000-000000000000', // System user for connection tests
        old_data: null,
        new_data: {
          source_id: sourceId,
          source_name: source?.name || 'Unknown source',
          ...metadata,
        },
      });
    
    if (error) {
      console.error('Error logging connection test:', error);
    }
  } catch (error) {
    console.error('Error in logConnectionTest:', error);
  }
}

// Main request handler
Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  
  try {
    // Parse request body
    const { sourceId } = await req.json();
    
    if (!sourceId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Source ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Run advanced connection test
    const result = await runAdvancedConnectionTest(sourceId);
    
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in advanced-connection-test:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
