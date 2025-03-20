
import { RateLimitInfo, extractIdFromGid } from "@/integrations/supabase/client";

// Query engine configuration
export interface QueryEngineConfig {
  batchSize: number;
  concurrentRequests: number;
  throttleDelay: number;
  maxRetries: number;
  timeoutSeconds: number;
  deduplicate: boolean;
  enableCaching: boolean;
  fieldOptimization: boolean;
}

// Query progress type
export interface QueryProgress {
  totalItems: number;
  processedItems: number;
  completedBatches: number;
  totalBatches: number;
  currentPhase: string;
  estimatedTimeRemaining: number | null;
  startTime: Date;
  isPaused: boolean;
  errors: QueryError[];
  rateLimitInfo: RateLimitInfo | null;
  performanceMetrics: {
    recordsPerSecond: number;
    apiCallsPerRecord: number;
    averageResponseTime: number;
  };
}

// Query error type
export interface QueryError {
  phase: string;
  message: string;
  timestamp: Date;
  itemId?: string;
  retryable: boolean;
  context?: Record<string, any>;
}

// Query result type
export interface QueryResult<T> {
  data: T[];
  errors: QueryError[];
  performance: {
    totalTime: number;
    apiCalls: number;
    recordsProcessed: number;
    recordsPerSecond: number;
    apiCallsPerRecord: number;
    averageResponseTime: number;
    quotaUsage: number;
  };
  metadata: Record<string, any>;
}

// Batch processor type
export interface BatchProcessor<T, R> {
  process: (
    items: T[],
    batchIndex: number,
    context: QueryContext
  ) => Promise<R[]>;
  getItemId: (item: T) => string;
  maxBatchSize: number;
}

// Query context for sharing state between phases
export interface QueryContext {
  startTime: Date;
  cache: Map<string, any>;
  processedIds: Set<string>;
  errors: QueryError[];
  apiCalls: number;
  totalResponseTime: number;
  rateLimitInfo: RateLimitInfo | null;
  pause: () => void;
  resume: () => void;
  isPaused: boolean;
  onProgress?: (progress: QueryProgress) => void;
}

// Cache manager for query results
class QueryCache {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private maxAge: number;

  constructor(maxAgeMs: number = 5 * 60 * 1000) { // Default 5 minutes
    this.maxAge = maxAgeMs;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }

  // Purge expired entries
  purge(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        this.cache.delete(key);
      }
    }
  }
}

// Global query cache instance
export const queryCache = new QueryCache();

// Delay utility that respects pausing
const delay = async (ms: number, isPaused: () => boolean): Promise<void> => {
  const startTime = Date.now();
  while (Date.now() - startTime < ms) {
    if (isPaused()) {
      await new Promise(resolve => setTimeout(resolve, 100));
    } else {
      await new Promise(resolve => setTimeout(resolve, Math.min(ms - (Date.now() - startTime), 100)));
    }
  }
};

// Create batches from an array of items
export const createBatches = <T>(items: T[], batchSize: number): T[][] => {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
};

// Process batches with controlled concurrency and throttling
export const processBatchesWithConcurrency = async <T, R>(
  batches: T[][],
  processor: BatchProcessor<T, R>,
  config: QueryEngineConfig,
  onProgress?: (progress: QueryProgress) => void
): Promise<QueryResult<R>> => {
  const startTime = new Date();
  const totalItems = batches.reduce((sum, batch) => sum + batch.length, 0);
  const context: QueryContext = {
    startTime,
    cache: new Map(),
    processedIds: new Set(),
    errors: [],
    apiCalls: 0,
    totalResponseTime: 0,
    rateLimitInfo: null,
    isPaused: false,
    pause: () => { context.isPaused = true; },
    resume: () => { context.isPaused = false; },
    onProgress
  };

  let processedItems = 0;
  let completedBatches = 0;
  const results: R[] = [];

  // Process batches with controlled concurrency
  for (let i = 0; i < batches.length; i += config.concurrentRequests) {
    // Process a group of batches concurrently
    const batchGroup = batches.slice(i, i + config.concurrentRequests);
    
    // Create a batch processing promise for each batch in the group
    const batchPromises = batchGroup.map(async (batch, index) => {
      try {
        // Process the batch
        const batchResult = await processor.process(batch, i + index, context);
        
        // Update tracking
        processedItems += batch.length;
        completedBatches++;
        
        // Calculate progress metrics
        const elapsedMs = new Date().getTime() - startTime.getTime();
        const recordsPerSecond = elapsedMs > 0 ? (processedItems / (elapsedMs / 1000)) : 0;
        const apiCallsPerRecord = processedItems > 0 ? (context.apiCalls / processedItems) : 0;
        const averageResponseTime = context.apiCalls > 0 ? (context.totalResponseTime / context.apiCalls) : 0;
        
        // Update progress
        if (onProgress) {
          const estimatedTimeRemaining = recordsPerSecond > 0 
            ? ((totalItems - processedItems) / recordsPerSecond) * 1000 
            : null;
            
          onProgress({
            totalItems,
            processedItems,
            completedBatches,
            totalBatches: batches.length,
            currentPhase: `Processing batch ${completedBatches}/${batches.length}`,
            estimatedTimeRemaining,
            startTime,
            isPaused: context.isPaused,
            errors: context.errors,
            rateLimitInfo: context.rateLimitInfo,
            performanceMetrics: {
              recordsPerSecond,
              apiCallsPerRecord,
              averageResponseTime
            }
          });
        }
        
        return batchResult;
      } catch (error) {
        // Log the error but continue processing other batches
        const queryError: QueryError = {
          phase: 'batch_processing',
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
          retryable: false,
          context: { batchIndex: i + index }
        };
        context.errors.push(queryError);
        console.error(`Error processing batch ${i + index}:`, error);
        return [] as R[];
      }
    });
    
    // Wait for all batches in this group to complete
    const batchResults = await Promise.all(batchPromises);
    
    // Add results from this batch group to the overall results
    for (const batchResult of batchResults) {
      results.push(...batchResult);
    }
    
    // Throttle between batch groups to avoid rate limiting
    if (i + config.concurrentRequests < batches.length) {
      await delay(config.throttleDelay, () => context.isPaused);
    }
  }

  // Calculate final performance metrics
  const totalTime = new Date().getTime() - startTime.getTime();
  const recordsPerSecond = totalTime > 0 ? (processedItems / (totalTime / 1000)) : 0;
  const apiCallsPerRecord = processedItems > 0 ? (context.apiCalls / processedItems) : 0;
  const averageResponseTime = context.apiCalls > 0 ? (context.totalResponseTime / context.apiCalls) : 0;
  const quotaUsage = context.rateLimitInfo ? 
    ((context.rateLimitInfo.maximum - context.rateLimitInfo.available) / context.rateLimitInfo.maximum) * 100 : 0;

  return {
    data: results,
    errors: context.errors,
    performance: {
      totalTime,
      apiCalls: context.apiCalls,
      recordsProcessed: processedItems,
      recordsPerSecond,
      apiCallsPerRecord,
      averageResponseTime,
      quotaUsage
    },
    metadata: {
      batches: batches.length,
      batchSize: config.batchSize,
      concurrentRequests: config.concurrentRequests,
      throttleDelay: config.throttleDelay,
      deduplication: config.deduplicate,
      caching: config.enableCaching
    }
  };
};

// Function to extract and deduplicate IDs from Shopify data
export const extractAndDeduplicateIds = (
  items: any[],
  pathToIds: string | ((item: any) => string[]),
  transform?: (id: string) => string
): string[] => {
  const idSet = new Set<string>();
  
  items.forEach(item => {
    let ids: string[] = [];
    
    if (typeof pathToIds === 'function') {
      ids = pathToIds(item);
    } else {
      // Handle dot notation path to get the ID
      const parts = pathToIds.split('.');
      let value = item;
      
      for (const part of parts) {
        if (value == null) break;
        value = value[part];
      }
      
      if (Array.isArray(value)) {
        ids = value;
      } else if (value != null) {
        ids = [String(value)];
      }
    }
    
    // Add ids to the set, applying transformation if needed
    ids.forEach(id => {
      if (id) {
        idSet.add(transform ? transform(id) : id);
      }
    });
  });
  
  return Array.from(idSet);
};

// Default configuration
export const DEFAULT_QUERY_CONFIG: QueryEngineConfig = {
  batchSize: 25,
  concurrentRequests: 4,
  throttleDelay: 500,
  maxRetries: 3,
  timeoutSeconds: 30,
  deduplicate: true,
  enableCaching: true,
  fieldOptimization: true
};
