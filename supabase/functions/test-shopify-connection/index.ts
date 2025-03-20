
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

// Define Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// Test Shopify connection with provided credentials
async function testShopifyConnection(connectionData: {
  store_url: string;
  api_key: string;
  api_secret: string;
  access_token: string;
  api_version: string;
  connection_timeout: number;
  max_retries: number;
  throttle_rate: number;
  custom_headers: Record<string, string>;
}) {
  // Validate and clean up the store URL
  let storeUrl = connectionData.store_url;
  if (!storeUrl.startsWith('https://')) {
    storeUrl = `https://${storeUrl}`;
  }
  
  // Remove trailing slash if present
  if (storeUrl.endsWith('/')) {
    storeUrl = storeUrl.slice(0, -1);
  }
  
  // Prepare the shop API URL
  const shopApiUrl = `${storeUrl}/admin/api/${connectionData.api_version}/shop.json`;
  
  // Prepare headers with authentication
  const headers = {
    'X-Shopify-Access-Token': connectionData.access_token,
    'Content-Type': 'application/json',
    ...connectionData.custom_headers,
  };
  
  // Set up timeout
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort();
  }, connectionData.connection_timeout * 1000);
  
  try {
    // Make the request with retry handling
    const response = await retryWithBackoff(
      () => fetch(shopApiUrl, {
        method: 'GET',
        headers,
        signal: timeoutController.signal,
      }),
      connectionData.max_retries
    );
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    // Extract rate limit information from headers
    const rateLimitHeader = response.headers.get('X-Shopify-Shop-Api-Call-Limit');
    const rateLimitData = rateLimitHeader
      ? {
          available: parseInt(rateLimitHeader.split('/')[0]),
          total: parseInt(rateLimitHeader.split('/')[1]),
        }
      : {
          available: 0,
          total: 40,
        };
    
    // Handle the response based on status code
    if (response.ok) {
      const shopData = await response.json();
      
      // Test throttling by waiting a specified amount of time
      if (connectionData.throttle_rate > 0) {
        const throttleDelay = 1000 / connectionData.throttle_rate;
        await new Promise(resolve => setTimeout(resolve, throttleDelay));
      }
      
      return {
        success: true,
        message: `Successfully connected to ${shopData.shop.name}`,
        shop: shopData.shop,
        rate_limits: rateLimitData,
      };
    } else {
      let errorMessage = '';
      
      // Try to parse the error response as JSON
      try {
        const errorData = await response.json();
        errorMessage = errorData.errors || JSON.stringify(errorData);
      } catch {
        // If not JSON, get as text
        errorMessage = await response.text();
      }
      
      const statusMessage = getShopifyErrorMessage(response.status);
      
      return {
        success: false,
        message: `${statusMessage}: ${errorMessage}`,
        status: response.status,
        rate_limits: rateLimitData,
      };
    }
  } catch (error) {
    // Clear the timeout
    clearTimeout(timeoutId);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: `Connection timed out after ${connectionData.connection_timeout} seconds`,
        };
      }
      
      // Handle other known error types
      if (error.message.includes('fetch failed')) {
        return {
          success: false,
          message: `Unable to reach ${storeUrl}. Please check the store URL and your network connection.`,
        };
      }
      
      return {
        success: false,
        message: `Connection error: ${error.message}`,
      };
    }
    
    return {
      success: false,
      message: 'Unknown connection error occurred',
    };
  }
}

// Get a friendly error message based on Shopify API status code
function getShopifyErrorMessage(statusCode: number): string {
  switch (statusCode) {
    case 401:
      return 'Authentication failed. Please check your API key and access token';
    case 402:
      return 'Payment required. Your store subscription may have issues';
    case 403:
      return 'Access forbidden. Your access token may not have the required permissions';
    case 404:
      return 'Resource not found. Please check your store URL and API version';
    case 406:
      return 'Not acceptable. Check content type headers';
    case 422:
      return 'Validation error';
    case 429:
      return 'Rate limit exceeded. Try again later or reduce your request frequency';
    case 500:
      return 'Shopify server error';
    case 503:
      return 'Shopify service unavailable. Try again later';
    default:
      return `Shopify API error (${statusCode})`;
  }
}

// Main request handler
Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  
  try {
    // Parse request body
    const connectionData = await req.json();
    
    // Validate required fields
    const requiredFields = ['store_url', 'access_token', 'api_version'];
    const missingFields = requiredFields.filter(field => !connectionData[field]);
    
    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Missing required fields: ${missingFields.join(', ')}`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Set default values for optional fields
    const testData = {
      ...connectionData,
      connection_timeout: connectionData.connection_timeout || 30,
      max_retries: connectionData.max_retries || 3,
      throttle_rate: connectionData.throttle_rate || 2,
      custom_headers: connectionData.custom_headers || {},
    };
    
    // Test connection
    const result = await testShopifyConnection(testData);
    
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in test-shopify-connection:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
