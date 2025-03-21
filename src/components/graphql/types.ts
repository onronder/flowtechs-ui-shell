
export interface TypeField {
  name: string;
  type: string;
  description: string | null;
  args: FieldArgument[];
  selected: boolean;
  subfields?: TypeField[];
  expanded?: boolean;
  isDeprecated?: boolean;
  deprecationReason?: string | null;
}

export interface FieldArgument {
  name: string;
  type: string;
  description: string | null;
  defaultValue: string | null;
  value?: string;
}

export interface QueryVariable {
  name: string;
  type: string;
  defaultValue: string;
}

export interface QueryTemplate {
  id: string;
  name: string;
  description: string | null;
  query: string;
  variables: QueryVariable[];
  complexity: number;
  source_id: string;
  created_at: string;
  updated_at: string;
  execution_count?: number;
  average_execution_time?: number;
}

export interface QueryResult {
  success: boolean;
  data: any;
  error?: string;
  rateLimitInfo?: RateLimitInfo;
  fromCache?: boolean;
  executionTime?: number;
  requestId?: string;
}

// Define the JSON type helper for query details
export interface QueryDetailsJson {
  query: string;
  variables: Array<{
    name: string;
    type: string;
    defaultValue: string;
  }>;
  complexity: number;
  execution_count?: number;
  average_execution_time?: number;
}

// Shopify specific types
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

export interface RateLimitInfo {
  available: number;
  maximum: number;
  restoreRate: number;
  requestCost: number;
  resetAt?: string;
}

export interface ShopifyQueryMetrics {
  requestSize: number;
  responseSize: number;
  executionTime: number;
  timestamp: string;
  statusCode: number;
  rateLimitInfo?: RateLimitInfo;
}

export interface ShopifyExtractOptions {
  batchSize?: number;
  concurrency?: number;
  fieldSelection?: string[];
  includeMetafields?: boolean;
  dateRange?: string;
  filters?: Record<string, any>;
  maxRecords?: number;
  useCache?: boolean;
  cacheTTL?: number;
}

export interface SchemaValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
  deprecations?: {
    type: string;
    field: string;
    reason: string;
  }[];
}

export interface SchemaDiff {
  apiVersions: {
    old: string;
    new: string;
  };
  newTypes: string[];
  removedTypes: string[];
  changedTypes: {
    typeName: string;
    addedFields: string[];
    removedFields: string[];
    changedFields: {
      fieldName: string;
      oldType: string;
      newType: string;
      changes: string[];
    }[];
  }[];
  severity: 'info' | 'warning' | 'critical';
}

export interface DistributedLock {
  lockKey: string;
  lockId: string;
  acquiredAt: string;
  expiresAt: string;
}

export interface ExtractionMetrics {
  recordsProcessed: number;
  totalRecords?: number;
  apiCalls: number;
  averageResponseTime: number;
  startTime: string;
  endTime?: string;
  status: 'running' | 'completed' | 'failed';
  error?: string;
  requestsPerSecond?: number;
  recordsPerSecond?: number;
  rateLimitRemaining?: number;
  rateLimitUsed?: number;
}
