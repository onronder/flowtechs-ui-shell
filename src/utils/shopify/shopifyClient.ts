import { ShopifyErrorResponse, RateLimitInfo, ShopifyQueryMetrics } from "@/components/graphql/types";
import { supabase } from "@/integrations/supabase/client";

interface ShopifyClientOptions {
  apiVersion?: string;
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  headers?: Record<string, string>;
  metricsCallback?: (metrics: ShopifyQueryMetrics) => void;
  errorCallback?: (error: ShopifyErrorResponse) => void;
  useCache?: boolean;
  cacheTTL?: number;
}

interface QueryOptions {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  useCache?: boolean;
  cacheTTL?: number;
}

const executeShopifyQuery = async (
  sourceId: string,
  query: string,
  variables = {},
  options = {}
) => {
  try {
    const response = await supabase.functions.invoke("execute-shopify-query", {
      body: {
        sourceId,
        query,
        variables,
        ...options
      }
    });

    // Handle response processing
    if (response.error) {
      throw new Error(response.error.message);
    }

    // Process rate limit information
    if (response.data.rateLimitInfo) {
      // Use this variable to avoid mutating a constant
      let updatedRequestCost = response.data.rateLimitInfo.requestCost || 0;
      
      // Additional processing for rate limit info if needed
      console.log(`Request cost: ${updatedRequestCost}`);
    }

    return response.data;
  } catch (error) {
    console.error("Error executing Shopify query:", error);
    throw error;
  }
};

export const createShopifyClient = (sourceId: string) => {
  if (!sourceId) {
    throw new Error("Source ID is required to initialize the Shopify client.");
  }

  const getSourceId = () => sourceId;

  const executeQuery = async (query: string, variables = {}, options = {}) => {
    // Remove signal property if it exists as it's not supported by Supabase functions
    const safeOptions = { ...options };
    if ('signal' in safeOptions) {
      delete (safeOptions as any).signal;
    }
    
    return executeShopifyQuery(sourceId, query, variables, safeOptions);
  };

  return {
    getSourceId,
    executeQuery,
  };
};
