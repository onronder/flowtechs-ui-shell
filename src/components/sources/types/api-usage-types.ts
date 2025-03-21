
export interface ApiMetric {
  created_at: string;
  status_code: number;
  execution_time_ms: number;
  operation_type: string;
}

export interface ApiUsageChartProps {
  metrics: ApiMetric[];
}

export interface ChartDataPoint {
  date: string;
  requestCount: number;
  errorCount: number;
  avgResponseTime: number;
  totalTime: number;
}

export interface OperationChartData {
  name: string;
  value: number;
}
