import { supabase } from "@/integrations/supabase/client";
import {
  ShopifyErrorResponse,
  ShopifyErrorType,
  ShopifyErrorClassification,
  RateLimitInfo,
  RateLimitConfig,
  RateLimitState
} from "@/components/graphql/types";

const DEFAULT_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 30000;
const DEFAULT_TIMEOUT = 30000;
const MAX_RETRIES = 3;

// Error classification and handling
export function classifyShopifyError(error: any): ShopifyErrorClassification {
  if (!error) {
    return {
      type: 'UNKNOWN',
      message: 'Unknown error occurred',
      retryable: false
    };
  }

  // Handle GraphQL user errors
  if (error.graphQLErrors && error.graphQLErrors.length > 0) {
    const graphQLError = error.graphQLErrors[0];
    
    if (graphQLError.extensions?.code === 'THROTTLED') {
      return {
        type: 'THROTTLED',
        message: 'Request was throttled. Try again later.',
        retryable: true,
        suggestedAction: 'Wait and retry with exponential backoff'
      };
    }
    
    if (graphQLError.extensions?.code === 'ACCESS_DENIED') {
      return {
        type: 'AUTHORIZATION',
        message: 'Access denied. Check your app permissions.',
        retryable: false,
        suggestedAction: 'Verify API access scopes'
      };
    }
    
    if (graphQLError.extensions?.code === 'QUERY_COMPLEXITY_EXCEEDED') {
      return {
        type: 'QUERY_COMPLEXITY',
        message: 'Query complexity limit exceeded.',
        retryable: false,
        suggestedAction: 'Simplify your query or break it into smaller parts'
      };
    }
    
    return {
      type: 'USER_ERROR',
      message: graphQLError.message || 'GraphQL error occurred',
      retryable: false
    };
  }
  
  // Handle network errors
  if (error.networkError) {
    const statusCode = error.networkError.statusCode;
    
    if (statusCode === 401) {
      return {
        type: 'AUTHENTICATION',
        message: 'Authentication failed. Check your API credentials.',
        retryable: false,
        suggestedAction: 'Verify API key/password or refresh OAuth token'
      };
    }
    
    if (statusCode === 403) {
      return {
        type: 'AUTHORIZATION',
        message: 'Authorization failed. Check your access permissions.',
        retryable: false,
        suggestedAction: 'Verify app permissions'
      };
    }
    
    if (statusCode === 404) {
      return {
        type: 'NOT_FOUND',
        message: 'Resource not found.',
        retryable: false
      };
    }
    
    if (statusCode === 429) {
      return {
        type: 'THROTTLED',
        message: 'Too many requests. Rate limit exceeded.',
        retryable: true,
        suggestedAction: 'Implement rate limiting'
      };
    }
    
    if (statusCode >= 500) {
      return {
        type: 'INTERNAL_SERVER',
        message: 'Shopify server error.',
        retryable: true,
        suggestedAction: 'Retry with backoff'
      };
    }
    
    return {
      type: 'NETWORK',
      message: `Network error: ${error.networkError.message || 'Unknown network issue'}`,
      retryable: true
    };
  }
  
  // Handle other cases
  const errorMessage = error.message || String(error);
  
  if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
    return {
      type: 'NETWORK',
      message: 'Request timed out',
      retryable: true,
      suggestedAction: 'Check network connection and retry with longer timeout'
    };
  }
  
  return {
    type: 'UNKNOWN',
    message: errorMessage,
    retryable: false
  };
}

// Extract rate limit information from Shopify response headers
export function extractRateLimitInfo(headers: Headers): RateLimitInfo | null {
  try {
    const available = parseInt(headers.get('X-Shopify-Shop-Api-Call-Limit')?.split('/')[0] || '0');
    const maximum = parseInt(headers.get('X-Shopify-Shop-Api-Call-Limit')?.split('/')[1] || '40');
    const restoreRate = 50; // Default: Shopify restores 50 points per second
    const requestCost = 1; // Default cost for regular queries
    
    // Try to parse cost if available from GraphQL response
    const costHeader = headers.get('X-GraphQL-Cost-Include-Fields');
    if (costHeader) {
      try {
        const costInfo = JSON.parse(costHeader);
        if (costInfo.requestedQueryCost) {
          requestCost = costInfo.requestedQueryCost;
        }
      } catch (e) {
        // Ignore parsing errors for cost
      }
    }
    
    return {
      available,
      maximum,
      restoreRate,
      requestCost
    };
  } catch (error) {
    console.error('Error extracting rate limit info:', error);
    return null;
  }
}

// Token bucket rate limiter implementation
export class ShopifyRateLimiter {
  private config: RateLimitConfig;
  private state: RateLimitState;
  private requestQueue: Array<{
    resolve: (value: void) => void;
    reject: (reason?: any) => void;
    priority: number;
  }> = [];
  private processingQueue = false;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      maxTokens: config.maxTokens || 40,
      refillRate: config.refillRate || 50,
      refillInterval: config.refillInterval || 1000,
      queueSize: config.queueSize || 100,
      timeout: config.timeout || 60000
    };
    
    this.state = {
      tokens: this.config.maxTokens,
      lastRefill: Date.now(),
      queuedRequests: 0
    };
  }

  private refillTokens() {
    const now = Date.now();
    const timePassed = now - this.state.lastRefill;
    const tokensToAdd = Math.floor(timePassed / this.config.refillInterval * this.config.refillRate);
    
    if (tokensToAdd > 0) {
      this.state.tokens = Math.min(this.config.maxTokens, this.state.tokens + tokensToAdd);
      this.state.lastRefill = now;
    }
  }

  private async processQueue() {
    if (this.processingQueue) return;
    
    this.processingQueue = true;
    
    while (this.requestQueue.length > 0) {
      this.refillTokens();
      
      if (this.state.tokens > 0) {
        // Sort by priority (lower number = higher priority)
        this.requestQueue.sort((a, b) => a.priority - b.priority);
        
        const { resolve } = this.requestQueue.shift()!;
        this.state.tokens--;
        this.state.queuedRequests--;
        resolve();
      } else {
        // Wait for tokens to refill
        const timeToNextToken = this.config.refillInterval / this.config.refillRate;
        await new Promise(resolve => setTimeout(resolve, timeToNextToken));
      }
    }
    
    this.processingQueue = false;
  }

  async acquireToken(cost = 1, priority = 10): Promise<void> {
    this.refillTokens();
    
    // If we have enough tokens, consume them immediately
    if (this.state.tokens >= cost) {
      this.state.tokens -= cost;
      return Promise.resolve();
    }
    
    // Otherwise, queue the request
    if (this.state.queuedRequests >= (this.config.queueSize || 100)) {
      return Promise.reject(new Error('Rate limit queue is full'));
    }
    
    this.state.queuedRequests++;
    
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        // Find and remove this request from the queue
        const index = this.requestQueue.findIndex(req => req.reject === reject);
        if (index !== -1) {
          this.requestQueue.splice(index, 1);
          this.state.queuedRequests--;
        }
        reject(new Error('Rate limit token acquisition timed out'));
      }, this.config.timeout);
    });
    
    const acquirePromise = new Promise<void>((resolve, reject) => {
      this.requestQueue.push({ resolve, reject, priority });
      this.processQueue();
    });
    
    return Promise.race([acquirePromise, timeoutPromise]);
  }

  getState(): RateLimitState {
    this.refillTokens();
    return { ...this.state };
  }

  updateLimits(rateLimitInfo: RateLimitInfo) {
    if (rateLimitInfo.maximum && rateLimitInfo.maximum !== this.config.maxTokens) {
      this.config.maxTokens = rateLimitInfo.maximum;
      // Adjust current tokens proportionally
      this.state.tokens = Math.min(this.state.tokens, this.config.maxTokens);
    }
    
    if (rateLimitInfo.restoreRate && rateLimitInfo.restoreRate !== this.config.refillRate) {
      this.config.refillRate = rateLimitInfo.restoreRate;
    }
  }
}

// Global rate limiter instance
const globalRateLimiter = new ShopifyRateLimiter();

// Request deduplication cache
const requestCache = new Map<string, { data: any; timestamp: number }>();

// Shopify GraphQL client with error handling, retries, and rate limiting
export async function executeShopifyQuery<T = any>(
  sourceId: string,
  query: string,
  variables: Record<string, any> = {},
  options: {
    useCache?: boolean;
    cacheTTL?: number;
    retries?: number;
    timeout?: number;
    priority?: number;
    cacheKey?: string;
  } = {}
): Promise<T> {
  const {
    useCache = true,
    cacheTTL = 5 * 60 * 1000, // 5 minutes default cache TTL
    retries = MAX_RETRIES,
    timeout = DEFAULT_TIMEOUT,
    priority = 10,
    cacheKey
  } = options;
  
  // Generate cache key if not provided
  const actualCacheKey = cacheKey || `${sourceId}:${query}:${JSON.stringify(variables)}`;
  
  // Check cache if enabled
  if (useCache) {
    const cached = requestCache.get(actualCacheKey);
    if (cached && Date.now() - cached.timestamp < cacheTTL) {
      return cached.data;
    }
  }
  
  // Set up retry logic
  let lastError: any = null;
  let attempt = 0;
  
  while (attempt <= retries) {
    try {
      // Acquire rate limiting token
      await globalRateLimiter.acquireToken(1, priority);
      
      // Execute query with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await supabase.functions.invoke('execute-shopify-query', {
        body: {
          sourceId,
          query,
          variables
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.error) {
        throw response.error;
      }
      
      if (response.data.success === false) {
        throw new Error(response.data.error || 'Query execution failed');
      }
      
      // Update rate limiter with actual limits from response if available
      if (response.data.rateLimitInfo) {
        globalRateLimiter.updateLimits(response.data.rateLimitInfo);
      }
      
      // Store successful response in cache
      if (useCache) {
        requestCache.set(actualCacheKey, {
          data: response.data,
          timestamp: Date.now()
        });
      }
      
      return response.data;
    } catch (error) {
      lastError = error;
      const errorClassification = classifyShopifyError(error);
      
      // Don't retry if the error is not retryable
      if (!errorClassification.retryable || attempt >= retries) {
        break;
      }
      
      // Exponential backoff with jitter
      const delay = Math.min(
        Math.pow(2, attempt) * DEFAULT_RETRY_DELAY + Math.random() * 1000,
        MAX_RETRY_DELAY
      );
      
      console.warn(
        `Shopify query attempt ${attempt + 1}/${retries + 1} failed: ${errorClassification.message}. Retrying in ${delay}ms...`
      );
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      
      attempt++;
    }
  }
  
  // All retries failed
  const finalError = classifyShopifyError(lastError);
  throw new Error(`Shopify query failed after ${retries + 1} attempts: ${finalError.message}`);
}

// Create a configured client for a specific Shopify source
export function createShopifyClient(sourceId: string) {
  const rateLimiter = new ShopifyRateLimiter();
  const clientCache = new Map<string, { data: any; timestamp: number }>();
  
  return {
    /**
     * Execute a GraphQL query against the Shopify API
     */
    query: async <T = any>(
      query: string,
      variables: Record<string, any> = {},
      options: {
        useCache?: boolean;
        cacheTTL?: number;
        retries?: number;
        timeout?: number;
        priority?: number;
        cacheKey?: string;
      } = {}
    ): Promise<T> => {
      return executeShopifyQuery<T>(sourceId, query, variables, options);
    },
    
    /**
     * Clear the client's cache
     */
    clearCache: () => {
      clientCache.clear();
    },
    
    /**
     * Get the current rate limit state
     */
    getRateLimitState: () => {
      return rateLimiter.getState();
    }
  };
}
