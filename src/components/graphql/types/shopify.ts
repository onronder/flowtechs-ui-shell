
import { RateLimitInfo } from './queryResults';

export interface ShopifySchemaVersion {
  apiVersion: string;
  lastUpdated: string;
  hash: string;
}

export interface ShopifyErrorResponse {
  type: 'GRAPHQL_ERROR' | 'NETWORK_ERROR' | 'RATE_LIMIT' | 'AUTHENTICATION' | 'SERVER_ERROR' | 'VALIDATION_ERROR' | 'UNKNOWN';
  message: string;
  code?: string;
  statusCode?: number;
  retryAfter?: number;
  requestId?: string;
  details?: Record<string, any>;
}

export interface ShopifyCursorPagination {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

export interface ShopifyQueryMetrics {
  requestSize: number;
  responseSize: number;
  executionTime: number;
  timestamp: string;
  statusCode: number;
  rateLimitInfo?: RateLimitInfo;
}

// Error Handling types
export type ShopifyErrorType = 
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'QUERY_COMPLEXITY'
  | 'INTERNAL_SERVER'
  | 'THROTTLED'
  | 'USER_ERROR'
  | 'NETWORK'
  | 'UNKNOWN';

export interface ShopifyErrorClassification {
  type: ShopifyErrorType;
  message: string;
  retryable: boolean;
  suggestedAction?: string;
}

// Rate Limiter types
export interface RateLimitConfig {
  maxTokens: number;
  refillRate: number;
  refillInterval: number;
  queueSize?: number;
  timeout?: number;
}

export interface RateLimitState {
  tokens: number;
  lastRefill: number;
  queuedRequests: number;
}
