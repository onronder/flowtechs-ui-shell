
import { ApiMetric, ChartDataPoint } from '../types/api-usage-types';

export const processMetricsData = (metrics: ApiMetric[], period: string): ChartDataPoint[] => {
  if (!metrics.length) return [];
  
  // Sort metrics by timestamp
  const sortedMetrics = [...metrics].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  
  // Group by time period
  const groupedData: Record<string, ChartDataPoint> = {};
  
  sortedMetrics.forEach(metric => {
    const date = new Date(metric.created_at);
    let key;
    
    if (period === 'hourly') {
      key = `${date.toLocaleDateString()} ${date.getHours()}:00`;
    } else if (period === 'daily') {
      key = date.toLocaleDateString();
    } else if (period === 'weekly') {
      // Get the week number
      const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
      const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
      const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
      key = `Week ${weekNumber}, ${date.getFullYear()}`;
    } else if (period === 'monthly') {
      key = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
    }
    
    if (!groupedData[key]) {
      groupedData[key] = { 
        date: key, 
        requestCount: 0, 
        errorCount: 0,
        avgResponseTime: 0,
        totalTime: 0
      };
    }
    
    groupedData[key].requestCount++;
    if (metric.status_code >= 400) {
      groupedData[key].errorCount++;
    }
    
    if (metric.execution_time_ms) {
      groupedData[key].totalTime += metric.execution_time_ms;
    }
  });
  
  // Calculate averages and convert to array
  return Object.values(groupedData).map(group => ({
    ...group,
    avgResponseTime: group.requestCount > 0 ? group.totalTime / group.requestCount : 0
  }));
};

export const generateMetricsSummary = (metrics: ApiMetric[]) => {
  const totalRequests = metrics.length;
  const successfulRequests = metrics.filter(m => m.status_code < 400).length;
  const failedRequests = totalRequests - successfulRequests;
  const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
  const avgResponseTime = metrics.length > 0
    ? (metrics.reduce((sum, m) => sum + (m.execution_time_ms || 0), 0) / metrics.length)
    : 0;

  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    successRate,
    avgResponseTime
  };
};

export const getOperationTypeData = (metrics: ApiMetric[]) => {
  // Group metrics by operation type
  const operationTypeData: Record<string, number> = {};
  
  metrics.forEach(metric => {
    const type = metric.operation_type || 'unknown';
    if (!operationTypeData[type]) {
      operationTypeData[type] = 0;
    }
    operationTypeData[type]++;
  });
  
  return Object.entries(operationTypeData).map(([name, value]) => ({
    name,
    value
  }));
};
