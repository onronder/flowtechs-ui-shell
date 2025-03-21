
export interface QueryResult {
  success: boolean;
  data: any;
  error?: string;
  rateLimitInfo?: RateLimitInfo;
  fromCache?: boolean;
  executionTime?: number;
  requestId?: string;
}

export interface RateLimitInfo {
  available: number;
  maximum: number;
  restoreRate: number;
  requestCost: number;
  resetAt?: string;
}
