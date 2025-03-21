
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
