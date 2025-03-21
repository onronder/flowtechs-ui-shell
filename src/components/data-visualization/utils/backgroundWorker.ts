
/**
 * Utility for offloading heavy data processing to a Web Worker
 */

// Type for function names that can be executed in worker
export type WorkerFunctionName = 
  | 'processLargeDataset'
  | 'filterDataset'
  | 'aggregateData'
  | 'prepareExport'
  | 'detectAnomalies'
  | 'compareTimePeriods';

// Message types
export interface WorkerRequest<T = any> {
  id: string;
  fn: WorkerFunctionName;
  params: T;
}

export interface WorkerResponse<T = any> {
  id: string;
  result?: T;
  error?: string;
  progress?: number;
}

// Create a worker factory function
export function createDataWorker() {
  // Function to create worker blob
  const createWorkerBlob = () => {
    const workerCode = `
      // Worker implementation
      const ctx = self;
      
      // Main message handler
      ctx.addEventListener('message', async (event) => {
        const { id, fn, params } = event.data;
        
        try {
          let result;
          
          switch (fn) {
            case 'processLargeDataset':
              result = await processLargeDataset(params, progress => {
                ctx.postMessage({ id, progress });
              });
              break;
              
            case 'filterDataset':
              result = filterDataset(params);
              break;
              
            case 'aggregateData':
              result = aggregateData(params);
              break;
              
            case 'prepareExport':
              result = await prepareExport(params, progress => {
                ctx.postMessage({ id, progress });
              });
              break;
              
            case 'detectAnomalies':
              result = detectAnomalies(params);
              break;
              
            case 'compareTimePeriods':
              result = compareTimePeriods(params);
              break;
              
            default:
              throw new Error(\`Unknown function: \${fn}\`);
          }
          
          ctx.postMessage({ id, result });
        } catch (error) {
          ctx.postMessage({ 
            id, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      });
      
      // Process large datasets with progress reporting
      async function processLargeDataset(params, progressCallback) {
        const { data, batchSize = 1000, operations = [] } = params;
        const totalItems = data.length;
        let processedItems = 0;
        const results = [];
        
        // Process in batches to avoid blocking the thread too long
        for (let i = 0; i < totalItems; i += batchSize) {
          const batch = data.slice(i, i + batchSize);
          const batchResults = processBatch(batch, operations);
          results.push(...batchResults);
          
          processedItems += batch.length;
          progressCallback(processedItems / totalItems * 100);
          
          // Yield to allow UI updates
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        return results;
      }
      
      // Process a single batch of data
      function processBatch(batch, operations) {
        return batch.map(item => {
          let result = { ...item };
          
          // Apply each operation in sequence
          operations.forEach(op => {
            switch (op.type) {
              case 'transform':
                result = applyTransformation(result, op.config);
                break;
              case 'validate':
                result._validationErrors = validateItem(result, op.config);
                break;
              case 'enrich':
                result = enrichItem(result, op.config);
                break;
            }
          });
          
          return result;
        });
      }
      
      // Apply transformations to an item
      function applyTransformation(item, config) {
        const result = { ...item };
        
        if (config.fieldMappings) {
          config.fieldMappings.forEach(mapping => {
            if (mapping.from && mapping.to) {
              result[mapping.to] = item[mapping.from];
            }
          });
        }
        
        if (config.formatters) {
          Object.entries(config.formatters).forEach(([field, formatter]) => {
            if (item[field] !== undefined) {
              switch (formatter) {
                case 'date':
                  result[field] = new Date(item[field]).toISOString();
                  break;
                case 'number':
                  result[field] = Number(item[field]);
                  break;
                case 'boolean':
                  result[field] = Boolean(item[field]);
                  break;
                case 'string':
                  result[field] = String(item[field]);
                  break;
              }
            }
          });
        }
        
        return result;
      }
      
      // Validate an item against rules
      function validateItem(item, config) {
        const errors = [];
        
        if (config.rules) {
          config.rules.forEach(rule => {
            const { field, type, message } = rule;
            
            if (!field || !type) return;
            
            const value = item[field];
            let isValid = true;
            
            switch (type) {
              case 'required':
                isValid = value !== undefined && value !== null && value !== '';
                break;
              case 'email':
                isValid = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(value || ''));
                break;
              case 'number':
                isValid = !isNaN(Number(value));
                break;
              case 'min':
                isValid = Number(value) >= rule.min;
                break;
              case 'max':
                isValid = Number(value) <= rule.max;
                break;
              case 'pattern':
                isValid = new RegExp(rule.pattern).test(String(value || ''));
                break;
            }
            
            if (!isValid) {
              errors.push({ field, message: message || \`Invalid \${field}\` });
            }
          });
        }
        
        return errors.length > 0 ? errors : undefined;
      }
      
      // Enrich an item with additional data
      function enrichItem(item, config) {
        const result = { ...item };
        
        if (config.derivedFields) {
          config.derivedFields.forEach(field => {
            if (field.name && field.formula) {
              try {
                // Simple formula evaluation with field references
                let formula = field.formula;
                
                // Replace field references with actual values
                Object.keys(item).forEach(key => {
                  formula = formula.replace(new RegExp(\`\\{\${key}\\}\`, 'g'), item[key]);
                });
                
                // Use Function constructor to evaluate formula
                // Note: This is generally not recommended for production due to security concerns
                // A safer alternative would be to use a proper expression parser
                result[field.name] = new Function(\`return \${formula}\`)();
              } catch (error) {
                console.error(\`Error calculating derived field: \${field.name}\`, error);
                result[field.name] = null;
              }
            }
          });
        }
        
        return result;
      }
      
      // Filter dataset based on criteria
      function filterDataset({ data, filters }) {
        if (!filters || !Array.isArray(filters) || filters.length === 0) {
          return data;
        }
        
        return data.filter(item => {
          return filters.every(filter => {
            const { field, operator, value } = filter;
            const itemValue = item[field];
            
            switch (operator) {
              case 'eq': return itemValue === value;
              case 'neq': return itemValue !== value;
              case 'gt': return itemValue > value;
              case 'gte': return itemValue >= value;
              case 'lt': return itemValue < value;
              case 'lte': return itemValue <= value;
              case 'contains': 
                return String(itemValue).toLowerCase().includes(String(value).toLowerCase());
              case 'startsWith': 
                return String(itemValue).toLowerCase().startsWith(String(value).toLowerCase());
              case 'endsWith': 
                return String(itemValue).toLowerCase().endsWith(String(value).toLowerCase());
              case 'in':
                return Array.isArray(value) && value.includes(itemValue);
              default:
                return true;
            }
          });
        });
      }
      
      // Aggregate data for reports
      function aggregateData({ data, dimensions, measures }) {
        if (!data || !Array.isArray(data) || data.length === 0 || 
            !dimensions || !measures || !Array.isArray(measures)) {
          return [];
        }
        
        // Helper to get dimension key
        const getDimensionKey = (item) => {
          if (typeof dimensions === 'string') {
            return item[dimensions];
          }
          
          return dimensions.map(dim => item[dim]).join('::');
        };
        
        // Initialize aggregation object
        const aggregation = {};
        
        // Process each data item
        data.forEach(item => {
          const key = getDimensionKey(item);
          
          if (!aggregation[key]) {
            aggregation[key] = {
              _count: 0,
              _dimensions: typeof dimensions === 'string' 
                ? { [dimensions]: item[dimensions] }
                : dimensions.reduce((acc, dim) => ({ ...acc, [dim]: item[dim] }), {}),
            };
            
            // Initialize measures
            measures.forEach(measure => {
              if (typeof measure === 'string') {
                aggregation[key][measure] = 0;
              } else {
                aggregation[key][measure.name] = measure.type === 'count' ? 0 : null;
              }
            });
          }
          
          // Increment count
          aggregation[key]._count++;
          
          // Update measures
          measures.forEach(measure => {
            const measureName = typeof measure === 'string' ? measure : measure.name;
            const measureType = typeof measure === 'string' ? 'sum' : measure.type;
            const field = typeof measure === 'string' ? measure : measure.field;
            
            switch (measureType) {
              case 'sum':
                aggregation[key][measureName] += Number(item[field] || 0);
                break;
              case 'avg':
                // For average, we'll sum first and divide by count later
                if (aggregation[key][measureName] === null) {
                  aggregation[key][measureName] = 0;
                }
                aggregation[key][measureName] += Number(item[field] || 0);
                break;
              case 'min':
                const minVal = Number(item[field] || 0);
                if (aggregation[key][measureName] === null || minVal < aggregation[key][measureName]) {
                  aggregation[key][measureName] = minVal;
                }
                break;
              case 'max':
                const maxVal = Number(item[field] || 0);
                if (aggregation[key][measureName] === null || maxVal > aggregation[key][measureName]) {
                  aggregation[key][measureName] = maxVal;
                }
                break;
              case 'count':
                aggregation[key][measureName]++;
                break;
              case 'countDistinct':
                if (!aggregation[key][measureName + '_set']) {
                  aggregation[key][measureName + '_set'] = new Set();
                }
                aggregation[key][measureName + '_set'].add(item[field]);
                aggregation[key][measureName] = aggregation[key][measureName + '_set'].size;
                break;
            }
          });
        });
        
        // Convert to array and finalize calculations
        return Object.values(aggregation).map(agg => {
          const result = { ...agg._dimensions, count: agg._count };
          
          // Finalize measures
          measures.forEach(measure => {
            const measureName = typeof measure === 'string' ? measure : measure.name;
            const measureType = typeof measure === 'string' ? 'sum' : measure.type;
            
            if (measureType === 'avg') {
              result[measureName] = agg[measureName] / agg._count;
            } else {
              result[measureName] = agg[measureName];
            }
          });
          
          // Clean up temporary props
          measures.forEach(measure => {
            const measureName = typeof measure === 'string' ? measure : measure.name;
            if (result[measureName + '_set']) {
              delete result[measureName + '_set'];
            }
          });
          
          delete result._dimensions;
          
          return result;
        });
      }
      
      // Prepare data for export with progress reporting
      async function prepareExport(params, progressCallback) {
        const { data, format, options = {} } = params;
        const totalItems = data.length;
        let processedItems = 0;
        
        if (format === 'json') {
          // JSON export is straightforward
          return JSON.stringify(data, null, options.pretty ? 2 : undefined);
        }
        
        if (format === 'csv') {
          // Generate CSV
          const { columns = [], includeHeaders = true } = options;
          let csv = '';
          
          // Use all keys from first item if columns not provided
          const keys = columns.length > 0 
            ? columns.map(c => typeof c === 'string' ? c : c.field)
            : data.length > 0 ? Object.keys(data[0]) : [];
            
          // Add headers if required
          if (includeHeaders) {
            const headers = columns.length > 0 && columns[0].header
              ? columns.map(c => c.header || c.field)
              : keys;
              
            csv += headers.map(h => escapeCsvValue(h)).join(',') + '\\n';
          }
          
          // Convert each row in batches
          const batchSize = 1000;
          for (let i = 0; i < totalItems; i += batchSize) {
            const rows = [];
            const batchEnd = Math.min(i + batchSize, totalItems);
            
            for (let j = i; j < batchEnd; j++) {
              const item = data[j];
              const values = keys.map(key => {
                let value = item[key];
                
                // Format values
                if (value === null || value === undefined) {
                  return '';
                } else if (typeof value === 'object') {
                  return escapeCsvValue(JSON.stringify(value));
                } else {
                  return escapeCsvValue(String(value));
                }
              });
              
              rows.push(values.join(','));
              processedItems++;
            }
            
            csv += rows.join('\\n') + (batchEnd < totalItems ? '\\n' : '');
            progressCallback(processedItems / totalItems * 100);
            
            // Yield to prevent UI blocking
            await new Promise(resolve => setTimeout(resolve, 0));
          }
          
          return csv;
        }
        
        throw new Error(\`Unsupported export format: \${format}\`);
      }
      
      // Helper to escape CSV values
      function escapeCsvValue(value) {
        if (!value.includes(',') && !value.includes('"') && !value.includes('\\n')) {
          return value;
        }
        return '"' + value.replace(/"/g, '""') + '"';
      }
      
      // Detect anomalies in data
      function detectAnomalies({ data, field, method = 'zscore', threshold = 3 }) {
        if (!data || !Array.isArray(data) || data.length === 0 || !field) {
          return [];
        }
        
        // Extract values for analysis
        const values = data
          .map(item => Number(item[field]))
          .filter(val => !isNaN(val));
          
        if (values.length === 0) {
          return [];
        }
        
        let anomalies = [];
        
        if (method === 'zscore') {
          // Z-score method
          const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
          const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
          const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
          const stdDev = Math.sqrt(variance);
          
          anomalies = data.filter(item => {
            const value = Number(item[field]);
            if (isNaN(value)) return false;
            
            const zscore = Math.abs((value - mean) / stdDev);
            return zscore > threshold;
          });
        } else if (method === 'iqr') {
          // Interquartile Range method
          const sortedValues = [...values].sort((a, b) => a - b);
          const q1Index = Math.floor(sortedValues.length * 0.25);
          const q3Index = Math.floor(sortedValues.length * 0.75);
          const q1 = sortedValues[q1Index];
          const q3 = sortedValues[q3Index];
          const iqr = q3 - q1;
          const lowerBound = q1 - threshold * iqr;
          const upperBound = q3 + threshold * iqr;
          
          anomalies = data.filter(item => {
            const value = Number(item[field]);
            if (isNaN(value)) return false;
            
            return value < lowerBound || value > upperBound;
          });
        }
        
        return anomalies;
      }
      
      // Compare data between time periods
      function compareTimePeriods({ data, dateField, valueField, period1, period2, compareType = 'absolute' }) {
        if (!data || !Array.isArray(data) || !dateField || !valueField || !period1 || !period2) {
          return null;
        }
        
        // Parse period boundaries
        const p1Start = new Date(period1.start);
        const p1End = new Date(period1.end);
        const p2Start = new Date(period2.start);
        const p2End = new Date(period2.end);
        
        if (isNaN(p1Start.getTime()) || isNaN(p1End.getTime()) || 
            isNaN(p2Start.getTime()) || isNaN(p2End.getTime())) {
          throw new Error('Invalid period dates');
        }
        
        // Filter data for each period
        const period1Data = data.filter(item => {
          const date = new Date(item[dateField]);
          return date >= p1Start && date <= p1End;
        });
        
        const period2Data = data.filter(item => {
          const date = new Date(item[dateField]);
          return date >= p2Start && date <= p2End;
        });
        
        // Group by day and calculate totals
        const groupByDay = (periodData, startDate) => {
          const dailyData = {};
          const startTime = startDate.getTime();
          
          periodData.forEach(item => {
            const date = new Date(item[dateField]);
            const daysDiff = Math.floor((date.getTime() - startTime) / (24 * 60 * 60 * 1000));
            const value = Number(item[valueField] || 0);
            
            if (isNaN(value)) return;
            
            if (!dailyData[daysDiff]) {
              dailyData[daysDiff] = { day: daysDiff, total: 0, count: 0 };
            }
            
            dailyData[daysDiff].total += value;
            dailyData[daysDiff].count++;
          });
          
          return dailyData;
        };
        
        const p1DailyData = groupByDay(period1Data, p1Start);
        const p2DailyData = groupByDay(period2Data, p2Start);
        
        // Calculate period totals
        const p1Total = period1Data.reduce((sum, item) => sum + Number(item[valueField] || 0), 0);
        const p2Total = period2Data.reduce((sum, item) => sum + Number(item[valueField] || 0), 0);
        
        // Calculate difference
        let difference;
        let percentChange;
        
        if (compareType === 'absolute') {
          difference = p2Total - p1Total;
          percentChange = p1Total !== 0 ? (difference / p1Total) * 100 : null;
        } else if (compareType === 'percentage') {
          difference = p1Total !== 0 ? ((p2Total - p1Total) / p1Total) * 100 : null;
          percentChange = difference;
        }
        
        // Prepare day-by-day comparison for charting
        const daysCount = Math.max(
          Math.ceil((p1End.getTime() - p1Start.getTime()) / (24 * 60 * 60 * 1000)),
          Math.ceil((p2End.getTime() - p2Start.getTime()) / (24 * 60 * 60 * 1000))
        );
        
        const comparison = [];
        
        for (let i = 0; i <= daysCount; i++) {
          const p1Day = p1DailyData[i] || { day: i, total: 0, count: 0 };
          const p2Day = p2DailyData[i] || { day: i, total: 0, count: 0 };
          
          const p1Date = new Date(p1Start);
          p1Date.setDate(p1Date.getDate() + i);
          
          const p2Date = new Date(p2Start);
          p2Date.setDate(p2Date.getDate() + i);
          
          comparison.push({
            day: i,
            date1: p1Date.toISOString().split('T')[0],
            date2: p2Date.toISOString().split('T')[0],
            value1: p1Day.total,
            value2: p2Day.total,
            difference: p2Day.total - p1Day.total,
            percentChange: p1Day.total !== 0 
              ? ((p2Day.total - p1Day.total) / p1Day.total) * 100 
              : null
          });
        }
        
        return {
          period1: {
            start: p1Start.toISOString(),
            end: p1End.toISOString(),
            total: p1Total,
            count: period1Data.length
          },
          period2: {
            start: p2Start.toISOString(),
            end: p2End.toISOString(),
            total: p2Total,
            count: period2Data.length
          },
          difference,
          percentChange,
          dayByDay: comparison
        };
      }
    `;
    
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
  };
  
  // Create worker
  const workerUrl = createWorkerBlob();
  const worker = new Worker(workerUrl);
  
  // Request tracking
  const requests = new Map<string, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    onProgress?: (progress: number) => void;
  }>();
  
  // Handle responses from worker
  worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const { id, result, error, progress } = event.data;
    const request = requests.get(id);
    
    if (!request) return;
    
    if (progress !== undefined && request.onProgress) {
      request.onProgress(progress);
      return;
    }
    
    requests.delete(id);
    
    if (error) {
      request.reject(new Error(error));
    } else {
      request.resolve(result);
    }
  });
  
  // Generate a unique ID for requests
  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };
  
  // Execute a function in the worker
  const execute = <P, R>(
    fn: WorkerFunctionName, 
    params: P, 
    onProgress?: (progress: number) => void
  ): Promise<R> => {
    return new Promise((resolve, reject) => {
      const id = generateId();
      
      requests.set(id, { resolve, reject, onProgress });
      worker.postMessage({ id, fn, params });
    });
  };
  
  // Clean up
  const terminate = () => {
    worker.terminate();
    URL.revokeObjectURL(workerUrl);
    
    // Reject any pending requests
    requests.forEach(({ reject }) => {
      reject(new Error('Worker terminated'));
    });
    requests.clear();
  };
  
  return {
    execute,
    terminate
  };
}

// Type-safe worker functions
export function processLargeDataset<T>(
  worker: ReturnType<typeof createDataWorker>,
  data: T[],
  operations: Array<{
    type: 'transform' | 'validate' | 'enrich';
    config: any;
  }>,
  batchSize = 1000,
  onProgress?: (progress: number) => void
): Promise<T[]> {
  return worker.execute('processLargeDataset', {
    data,
    operations,
    batchSize
  }, onProgress);
}

export function filterDataset<T>(
  worker: ReturnType<typeof createDataWorker>,
  data: T[],
  filters: Array<{
    field: string;
    operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith' | 'in';
    value: any;
  }>
): Promise<T[]> {
  return worker.execute('filterDataset', { data, filters });
}

export function aggregateData<T>(
  worker: ReturnType<typeof createDataWorker>,
  data: T[],
  dimensions: string | string[],
  measures: Array<string | {
    name: string;
    type: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'countDistinct';
    field: string;
  }>
): Promise<any[]> {
  return worker.execute('aggregateData', { data, dimensions, measures });
}

export function prepareExport<T>(
  worker: ReturnType<typeof createDataWorker>,
  data: T[],
  format: 'json' | 'csv',
  options?: {
    pretty?: boolean;
    columns?: Array<string | { field: string; header?: string }>;
    includeHeaders?: boolean;
  },
  onProgress?: (progress: number) => void
): Promise<string> {
  return worker.execute('prepareExport', {
    data,
    format,
    options
  }, onProgress);
}

export function detectAnomalies<T>(
  worker: ReturnType<typeof createDataWorker>,
  data: T[],
  field: string,
  method: 'zscore' | 'iqr' = 'zscore',
  threshold: number = 3
): Promise<T[]> {
  return worker.execute('detectAnomalies', { data, field, method, threshold });
}

export function compareTimePeriods<T>(
  worker: ReturnType<typeof createDataWorker>,
  data: T[],
  dateField: string,
  valueField: string,
  period1: { start: string; end: string },
  period2: { start: string; end: string },
  compareType: 'absolute' | 'percentage' = 'absolute'
): Promise<{
  period1: { start: string; end: string; total: number; count: number };
  period2: { start: string; end: string; total: number; count: number };
  difference: number;
  percentChange: number | null;
  dayByDay: Array<{
    day: number;
    date1: string;
    date2: string;
    value1: number;
    value2: number;
    difference: number;
    percentChange: number | null;
  }>;
}> {
  return worker.execute('compareTimePeriods', {
    data,
    dateField,
    valueField,
    period1,
    period2,
    compareType
  });
}
