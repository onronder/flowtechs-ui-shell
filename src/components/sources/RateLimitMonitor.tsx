
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, TrendingUp } from "lucide-react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from "@/integrations/supabase/client";

interface RateLimitMonitorProps {
  sourceId: string;
  metrics: any[];
}

const RateLimitMonitor: React.FC<RateLimitMonitorProps> = ({ sourceId, metrics }) => {
  const [predictionData, setPredictionData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (metrics.length > 0) {
      generateRateLimitPrediction();
    }
  }, [sourceId, metrics]);
  
  // Process the rate limit data
  const processRateLimitData = () => {
    if (!metrics.length) return { current: null, history: [] };
    
    // Get the most recent rate limit data
    const rateLimitMetrics = metrics.filter(m => 
      m.rate_limit_available !== null && 
      m.rate_limit_maximum !== null
    );
    
    if (!rateLimitMetrics.length) return { current: null, history: [] };
    
    // Sort by timestamp (newest first)
    const sortedMetrics = [...rateLimitMetrics].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    // Get the most recent rate limit data
    const current = sortedMetrics[0];
    
    // Process historical data (sort by timestamp, earliest first)
    const history = [...sortedMetrics]
      .sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      .map(metric => ({
        timestamp: new Date(metric.created_at).toLocaleString(),
        available: metric.rate_limit_available,
        maximum: metric.rate_limit_maximum,
        used: metric.rate_limit_maximum - metric.rate_limit_available,
        percentUsed: ((metric.rate_limit_maximum - metric.rate_limit_available) / metric.rate_limit_maximum) * 100
      }));
    
    return { current, history };
  };
  
  const generateRateLimitPrediction = async () => {
    setLoading(true);
    try {
      // Simple client-side prediction based on recent usage patterns
      const { current, history } = processRateLimitData();
      
      if (!current || history.length < 2) {
        setPredictionData(null);
        return;
      }
      
      // Calculate average consumption rate (points per minute)
      const consumptionRates = [];
      for (let i = 1; i < history.length; i++) {
        const earlier = history[i-1];
        const later = history[i];
        
        const timeDiffMs = new Date(later.timestamp).getTime() - new Date(earlier.timestamp).getTime();
        const timeDiffMinutes = timeDiffMs / (1000 * 60);
        
        if (timeDiffMinutes > 0) {
          const pointsConsumed = (later.used - earlier.used);
          const rate = pointsConsumed / timeDiffMinutes;
          
          if (!isNaN(rate) && isFinite(rate)) {
            consumptionRates.push(rate);
          }
        }
      }
      
      // Calculate average consumption rate
      const avgConsumptionRate = consumptionRates.length > 0 
        ? consumptionRates.reduce((sum, rate) => sum + rate, 0) / consumptionRates.length 
        : 0;
      
      // Calculate time until rate limit would be reached
      const currentAvailable = current.rate_limit_available;
      const timeToLimitMinutes = avgConsumptionRate > 0 
        ? currentAvailable / avgConsumptionRate 
        : Infinity;
      
      // Generate prediction data
      const predictionHours = 3;
      const predictionIntervalMinutes = 15;
      const predictions = [];
      
      const restoreRate = 50; // Shopify typically restores 50 points per second
      const restorePerMinute = restoreRate * 60;
      
      let predictedAvailable = currentAvailable;
      const maximum = current.rate_limit_maximum;
      
      const now = new Date();
      
      for (let i = 0; i < (predictionHours * 60) / predictionIntervalMinutes; i++) {
        const minutesFromNow = i * predictionIntervalMinutes;
        const predictedTime = new Date(now.getTime() + minutesFromNow * 60 * 1000);
        
        // Calculate predicted consumption and restoration
        const consumed = avgConsumptionRate * predictionIntervalMinutes;
        const restored = restorePerMinute * predictionIntervalMinutes;
        
        // Update predicted available
        predictedAvailable = Math.min(
          maximum, 
          Math.max(0, predictedAvailable - consumed + restored)
        );
        
        predictions.push({
          time: predictedTime.toLocaleTimeString(),
          timestamp: predictedTime.toISOString(),
          available: Math.round(predictedAvailable),
          maximum,
          percentUsed: ((maximum - predictedAvailable) / maximum) * 100
        });
      }
      
      setPredictionData({
        predictions,
        avgConsumptionRate,
        timeToLimitMinutes,
        currentUsage: ((maximum - currentAvailable) / maximum) * 100
      });
    } catch (error) {
      console.error("Error generating rate limit prediction:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const { current, history } = processRateLimitData();
  
  // Determine rate limit status
  const getRateLimitStatus = () => {
    if (!current) return { status: 'unknown', message: 'No rate limit data available' };
    
    const percentUsed = ((current.rate_limit_maximum - current.rate_limit_available) / current.rate_limit_maximum) * 100;
    
    if (percentUsed > 80) {
      return { 
        status: 'critical', 
        message: 'Rate limit usage is critical. Consider implementing throttling or reducing request frequency.'
      };
    } else if (percentUsed > 50) {
      return { 
        status: 'warning', 
        message: 'Rate limit usage is moderate. Monitor closely during peak usage times.'
      };
    } else {
      return { 
        status: 'healthy', 
        message: 'Rate limit usage is healthy.'
      };
    }
  };
  
  const rateLimitStatus = getRateLimitStatus();

  return (
    <div className="space-y-6">
      {/* Current Rate Limit Status */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Rate Limit Status</CardTitle>
            {current && (
              <Badge 
                variant={
                  rateLimitStatus.status === 'critical' 
                    ? 'destructive' 
                    : rateLimitStatus.status === 'warning' 
                      ? 'secondary' 
                      : 'default'
                }
              >
                {rateLimitStatus.status === 'critical' 
                  ? 'Critical' 
                  : rateLimitStatus.status === 'warning' 
                    ? 'Warning' 
                    : 'Healthy'
                }
              </Badge>
            )}
          </div>
          <CardDescription>
            Current Shopify API rate limit consumption
          </CardDescription>
        </CardHeader>
        <CardContent>
          {current ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-1">
                <span>Current Usage</span>
                <span className="font-bold">
                  {current.rate_limit_maximum - current.rate_limit_available} / {current.rate_limit_maximum} points
                </span>
              </div>
              <Progress 
                value={((current.rate_limit_maximum - current.rate_limit_available) / current.rate_limit_maximum) * 100} 
                className="h-2"
              />
              
              <div className="pt-4">
                <p className="text-sm text-muted-foreground">{rateLimitStatus.message}</p>
              </div>
              
              {predictionData && predictionData.timeToLimitMinutes < 180 && (
                <Alert 
                  variant={predictionData.timeToLimitMinutes < 60 ? "destructive" : "default"}
                  className="mt-4"
                >
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Rate Limit Warning</AlertTitle>
                  <AlertDescription>
                    At current usage rates, you may reach the rate limit in approximately{' '}
                    {predictionData.timeToLimitMinutes < 60 
                      ? `${Math.round(predictionData.timeToLimitMinutes)} minutes` 
                      : `${Math.round(predictionData.timeToLimitMinutes / 60)} hours`
                    }.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">No rate limit data available</p>
          )}
        </CardContent>
      </Card>
      
      {/* Historical Rate Limit Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Historical Rate Limit Usage</CardTitle>
          <CardDescription>
            Track your rate limit consumption over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={history}
                  margin={{ top: 10, right: 30, left: 0, bottom: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp"
                    angle={-45}
                    textAnchor="end"
                    height={70}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(time) => new Date(time).toLocaleTimeString()}
                  />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => [`${value}`, 'Points']}
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="used" 
                    name="Points Used" 
                    stroke="#8884d8" 
                    fill="#8884d8" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="available" 
                    name="Points Available" 
                    stroke="#82ca9d" 
                    fill="#82ca9d" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No historical rate limit data available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Rate Limit Prediction */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Limit Forecast</CardTitle>
          <CardDescription>
            Predictive analysis of rate limit usage over the next few hours
          </CardDescription>
        </CardHeader>
        <CardContent>
          {predictionData ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 p-4 border rounded-md">
                  <p className="text-sm font-medium mb-1">Avg. Consumption Rate</p>
                  <p className="text-2xl font-bold">
                    {Math.round(predictionData.avgConsumptionRate * 100) / 100} points/min
                  </p>
                </div>
                <div className="flex-1 p-4 border rounded-md">
                  <p className="text-sm font-medium mb-1">Time Until Limit</p>
                  <p className="text-2xl font-bold">
                    {predictionData.timeToLimitMinutes === Infinity 
                      ? '∞' 
                      : predictionData.timeToLimitMinutes < 60 
                        ? `${Math.round(predictionData.timeToLimitMinutes)} min` 
                        : `${Math.round(predictionData.timeToLimitMinutes / 60)} hours`
                    }
                  </p>
                </div>
              </div>
              
              <div className="h-72 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={predictionData.predictions}
                    margin={{ top: 5, right: 30, left: 20, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time"
                      angle={-45}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="available" 
                      name="Predicted Available Points" 
                      stroke="#8884d8" 
                      activeDot={{ r: 8 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              <p className="text-sm text-muted-foreground mt-2">
                This forecast is based on your recent API usage patterns and Shopify's rate limit restoration rate.
                Actual results may vary depending on your application's behavior.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-72">
              <p className="text-muted-foreground">
                {loading ? 'Generating prediction...' : 'Not enough data to generate a forecast'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RateLimitMonitor;
