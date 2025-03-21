
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

// New types for requested components

// ShopifyDataTable types
export interface ShopifyDataTableProps {
  data: any[];
  columns: DataTableColumn[];
  pagination?: PaginationOptions;
  loading?: boolean;
  error?: string;
  onRowClick?: (row: any) => void;
}

export interface DataTableColumn {
  id: string;
  header: string;
  accessorKey?: string;
  accessorFn?: (row: any) => any;
  cell?: (info: { getValue: () => any; row: { original: any } }) => React.ReactNode;
  enableSorting?: boolean;
  enableFiltering?: boolean;
}

export interface PaginationOptions {
  pageSize: number;
  pageIndex: number;
  pageCount?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

// NestedJsonViewer types
export interface NestedJsonViewerProps {
  data: any;
  expandedByDefault?: boolean;
  maxDepth?: number;
  searchEnabled?: boolean;
  pathCopyEnabled?: boolean;
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

// Extraction Management types
export interface ExtractionJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  started: string;
  completed?: string;
  error?: string;
  config: Record<string, any>;
  type: string;
  results?: any;
}

// Dataset Diff types
export interface DatasetDiff {
  addedRecords: number;
  removedRecords: number;
  changedRecords: number;
  unchangedRecords: number;
  changes: RecordChange[];
}

export interface RecordChange {
  id: string;
  changeType: 'added' | 'removed' | 'changed';
  path?: string[];
  oldValue?: any;
  newValue?: any;
}

// Type for selected fields (simpler to avoid deep recursion)
export type SelectedFieldsMapType = Record<string, Set<string>>;
