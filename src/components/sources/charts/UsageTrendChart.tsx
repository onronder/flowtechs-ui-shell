
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiMetric, ChartDataPoint } from '../types/api-usage-types';
import { processMetricsData } from '../utils/metrics-processor';

interface UsageTrendChartProps {
  metrics: ApiMetric[];
  timePeriod: string;
  setTimePeriod: (period: string) => void;
}

const UsageTrendChart: React.FC<UsageTrendChartProps> = ({ 
  metrics, 
  timePeriod, 
  setTimePeriod 
}) => {
  const chartData = processMetricsData(metrics, timePeriod);

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Usage Trends</CardTitle>
        <CardDescription>
          Track API request patterns over time
        </CardDescription>
        <TabsList className="mt-2">
          <TabsTrigger 
            value="daily" 
            onClick={() => setTimePeriod('daily')}
            className={timePeriod === 'daily' ? 'bg-primary/20' : ''}
          >
            Daily
          </TabsTrigger>
          <TabsTrigger 
            value="weekly" 
            onClick={() => setTimePeriod('weekly')}
            className={timePeriod === 'weekly' ? 'bg-primary/20' : ''}
          >
            Weekly
          </TabsTrigger>
          <TabsTrigger 
            value="monthly" 
            onClick={() => setTimePeriod('monthly')}
            className={timePeriod === 'monthly' ? 'bg-primary/20' : ''}
          >
            Monthly
          </TabsTrigger>
        </TabsList>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 0, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date"
                  angle={-45}
                  textAnchor="end"
                  height={70}
                  tick={{ fontSize: 12 }}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="requestCount" 
                  name="Total Requests" 
                  stackId="1" 
                  stroke="#8884d8" 
                  fill="#8884d8" 
                />
                <Area 
                  type="monotone" 
                  dataKey="errorCount" 
                  name="Errors" 
                  stackId="2" 
                  stroke="#ff8042" 
                  fill="#ff8042" 
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">No data available for this time period</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default UsageTrendChart;
