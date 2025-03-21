
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ApiUsageChartProps {
  metrics: any[];
}

const ApiUsageChart: React.FC<ApiUsageChartProps> = ({ metrics }) => {
  const [timePeriod, setTimePeriod] = useState('daily');
  
  // Process metrics data for different time periods
  const processMetricsData = (period: string) => {
    if (!metrics.length) return [];
    
    // Sort metrics by timestamp
    const sortedMetrics = [...metrics].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    // Group by time period
    const groupedData = {};
    
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
  
  const chartData = processMetricsData(timePeriod);
  
  // Generate metrics summary
  const totalRequests = metrics.length;
  const successfulRequests = metrics.filter(m => m.status_code < 400).length;
  const failedRequests = totalRequests - successfulRequests;
  const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
  
  // Group metrics by operation type
  const operationTypeData = {};
  metrics.forEach(metric => {
    const type = metric.operation_type || 'unknown';
    if (!operationTypeData[type]) {
      operationTypeData[type] = 0;
    }
    operationTypeData[type]++;
  });
  
  const operationChartData = Object.entries(operationTypeData).map(([name, value]) => ({
    name,
    value
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalRequests}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{successRate.toFixed(1)}%</div>
            <p className="text-sm text-muted-foreground">
              {successfulRequests} successful / {failedRequests} failed
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Avg Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {metrics.length > 0
                ? `${(metrics.reduce((sum, m) => sum + (m.execution_time_ms || 0), 0) / metrics.length).toFixed(0)} ms`
                : '0 ms'
              }
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Trending Charts */}
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
      
      {/* Operation Type Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Operation Type Distribution</CardTitle>
          <CardDescription>
            Breakdown of API operations by type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            {operationChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={operationChartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" name="Request Count" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No operation data available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApiUsageChart;
