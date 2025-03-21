
import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltipContent, ChartTooltip } from '@/components/ui/chart';
import { Bar, BarChart, Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { processMetricsData, generateMetricsSummary, getOperationTypeData } from './utils/metrics-processor';
import { ApiMetric, ChartDataPoint, ApiUsageChartProps, OperationChartData } from './types/api-usage-types';
import { Loader2 } from 'lucide-react';

const ApiUsageChart = ({ metrics }: ApiUsageChartProps) => {
  const [timePeriod, setTimePeriod] = useState<'hourly' | 'daily' | 'weekly' | 'monthly'>('daily');
  const [chartType, setChartType] = useState<'requests' | 'time' | 'errors'>('requests');
  
  // Process metrics data based on selected time period
  const chartData: ChartDataPoint[] = useMemo(() => 
    processMetricsData(metrics, timePeriod),
    [metrics, timePeriod]
  );
  
  // Generate summary metrics
  const summary = useMemo(() => 
    generateMetricsSummary(metrics),
    [metrics]
  );
  
  // Generate operation type data
  const operationTypeData: OperationChartData[] = useMemo(() => 
    getOperationTypeData(metrics),
    [metrics]
  );
  
  // Chart configuration
  const getChartConfig = () => {
    switch (chartType) {
      case 'requests':
        return {
          dataKey: 'requestCount',
          stroke: '#3b82f6',
          fill: '#3b82f6',
          name: 'API Requests',
          yAxisLabel: 'Requests',
          gradient: {
            id: 'requests',
            colors: { light: '#bfdbfe', dark: '#3b82f6' },
          }
        };
      case 'time':
        return {
          dataKey: 'avgResponseTime',
          stroke: '#10b981',
          fill: '#10b981',
          name: 'Avg Response Time (ms)',
          yAxisLabel: 'Time (ms)',
          gradient: {
            id: 'time',
            colors: { light: '#d1fae5', dark: '#10b981' },
          }
        };
      case 'errors':
        return {
          dataKey: 'errorCount',
          stroke: '#ef4444',
          fill: '#ef4444',
          name: 'Error Count',
          yAxisLabel: 'Errors',
          gradient: {
            id: 'errors',
            colors: { light: '#fee2e2', dark: '#ef4444' },
          }
        };
      default:
        return {
          dataKey: 'requestCount',
          stroke: '#3b82f6',
          fill: '#3b82f6',
          name: 'API Requests',
          yAxisLabel: 'Requests',
          gradient: {
            id: 'requests',
            colors: { light: '#bfdbfe', dark: '#3b82f6' },
          }
        };
    }
  };
  
  const chartConfig = getChartConfig();
  
  // Loading state
  if (!metrics || metrics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>API Usage</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p>Loading API metrics...</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle>API Usage Analytics</CardTitle>
          
          <div className="flex flex-wrap gap-2 items-center">
            <Tabs
              value={chartType}
              onValueChange={(value) => setChartType(value as 'requests' | 'time' | 'errors')}
              className="h-9"
            >
              <TabsList className="h-9">
                <TabsTrigger value="requests" className="text-xs">Requests</TabsTrigger>
                <TabsTrigger value="time" className="text-xs">Response Time</TabsTrigger>
                <TabsTrigger value="errors" className="text-xs">Errors</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <Select
              value={timePeriod}
              onValueChange={(value) => setTimePeriod(value as 'hourly' | 'daily' | 'weekly' | 'monthly')}
            >
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg border p-3">
            <div className="text-sm font-medium text-muted-foreground">Total Requests</div>
            <div className="text-2xl font-bold">{summary.totalRequests.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-sm font-medium text-muted-foreground">Success Rate</div>
            <div className="text-2xl font-bold">{summary.successRate.toFixed(1)}%</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-sm font-medium text-muted-foreground">Avg Response Time</div>
            <div className="text-2xl font-bold">{summary.avgResponseTime.toFixed(0)} ms</div>
          </div>
        </div>
        
        <div className="h-[300px]">
          <ChartContainer
            config={{
              [chartConfig.dataKey]: {
                theme: {
                  light: chartConfig.stroke,
                  dark: chartConfig.stroke,
                },
              },
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(value) => 
                    value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString()
                  }
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  label={{ 
                    value: chartConfig.yAxisLabel, 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fontSize: 12, fill: '#888' }
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) {
                      return null;
                    }
                    return (
                      <ChartTooltipContent>
                        {/* Custom tooltip content */}
                        <div className="space-y-2">
                          <p className="font-medium text-sm">{payload[0].payload.date}</p>
                          <div className="text-xs flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: chartConfig.fill }}
                            />
                            <span>{chartConfig.name}: </span>
                            <span className="font-bold">
                              {payload[0].value}
                            </span>
                          </div>
                        </div>
                      </ChartTooltipContent>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey={chartConfig.dataKey}
                  stroke={chartConfig.stroke}
                  strokeWidth={2}
                  dot={{ r: 3, fill: chartConfig.fill, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
        
        {/* Operation Type Distribution */}
        <div className="mt-8">
          <h3 className="text-sm font-medium mb-3">Operation Type Distribution</h3>
          <div className="h-[300px]">
            <ChartContainer
              config={{
                value: {
                  theme: {
                    light: '#6366f1',
                    dark: '#6366f1',
                  },
                },
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={operationTypeData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    angle={-45}
                    textAnchor="end"
                  />
                  <YAxis
                    tickFormatter={(value) => 
                      value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString()
                    }
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) {
                        return null;
                      }
                      return (
                        <ChartTooltipContent>
                          <div className="space-y-2">
                            <p className="font-medium text-sm">{payload[0].payload.name}</p>
                            <div className="text-xs flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: '#6366f1' }}
                              />
                              <span>Count: </span>
                              <span className="font-bold">
                                {payload[0].value}
                              </span>
                            </div>
                          </div>
                        </ChartTooltipContent>
                      );
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill="#6366f1"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ApiUsageChart;
