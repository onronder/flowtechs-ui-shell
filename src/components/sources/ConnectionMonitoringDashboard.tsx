
import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle, Clock, Activity, Shield, TrendingUp, Zap } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, BarChart, Bar, Legend, LineChart, Line } from 'recharts';
import ConnectionHealthSummary from "./ConnectionHealthSummary";
import ApiUsageChart from "./ApiUsageChart";
import RateLimitMonitor from "./RateLimitMonitor";
import ConnectionSecurityAudit from "./ConnectionSecurityAudit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface MonitoringDashboardProps {
  sourceId: string;
}

const ConnectionMonitoringDashboard: React.FC<MonitoringDashboardProps> = ({ sourceId }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [connectionData, setConnectionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthScore, setHealthScore] = useState(0);
  const [isRunningTest, setIsRunningTest] = useState(false);

  useEffect(() => {
    fetchConnectionData();
    // Set up polling every 5 minutes for production monitoring
    const intervalId = setInterval(fetchConnectionData, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [sourceId]);

  const fetchConnectionData = async () => {
    setLoading(true);
    try {
      // Fetch connection data
      const { data, error } = await supabase
        .from('sources')
        .select('*, audit_logs(*)') 
        .eq('id', sourceId)
        .single();
      
      if (error) throw error;
      
      // Fetch API metrics for this source
      const { data: metricsData, error: metricsError } = await supabase
        .from('api_metrics')
        .select('*')
        .eq('source_id', sourceId)
        .order('created_at', { ascending: false })
        .limit(100);
        
      if (metricsError) throw metricsError;
      
      // Calculate health score based on various factors
      const healthScore = calculateHealthScore(data, metricsData || []);
      setHealthScore(healthScore);
      
      setConnectionData({
        source: data,
        metrics: metricsData || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch connection data');
      toast({
        title: "Error",
        description: "Failed to load connection monitoring data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateHealthScore = (source: any, metrics: any[]): number => {
    let score = 100; // Start with perfect score
    
    // Connection status impacts score
    if (source.connection_status !== 'connected') {
      score -= 50;
    }
    
    // Recent errors reduce score
    const recentErrors = metrics.filter(m => m.status_code >= 400).length;
    score -= Math.min(30, recentErrors * 3);
    
    // Rate limit usage impacts score
    const highRateLimitUsage = metrics.some(m => 
      m.rate_limit_available && m.rate_limit_maximum && 
      (m.rate_limit_available / m.rate_limit_maximum < 0.2)
    );
    if (highRateLimitUsage) {
      score -= 10;
    }
    
    // Slow response times impact score
    const slowResponses = metrics.filter(m => m.execution_time_ms > 2000).length;
    score -= Math.min(10, slowResponses);
    
    return Math.max(0, Math.min(100, score));
  };

  const runConnectionTest = async () => {
    setIsRunningTest(true);
    try {
      const response = await supabase.functions.invoke('advanced-connection-test', {
        body: { sourceId }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: response.data.success ? "Connection Verified" : "Connection Issues Detected",
        description: response.data.message,
        variant: response.data.success ? "default" : "destructive"
      });
      
      // Refresh data
      fetchConnectionData();
    } catch (err) {
      toast({
        title: "Test Failed",
        description: err instanceof Error ? err.message : "Failed to run connection test",
        variant: "destructive"
      });
    } finally {
      setIsRunningTest(false);
    }
  };

  // Generate health status indicator
  const getHealthStatus = () => {
    if (healthScore >= 80) return { label: "Healthy", color: "bg-green-500", icon: <CheckCircle className="w-5 h-5 text-green-500" /> };
    if (healthScore >= 50) return { label: "Warning", color: "bg-yellow-500", icon: <AlertCircle className="w-5 h-5 text-yellow-500" /> };
    return { label: "Critical", color: "bg-red-500", icon: <AlertCircle className="w-5 h-5 text-red-500" /> };
  };

  const healthStatus = getHealthStatus();

  if (loading && !connectionData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error && !connectionData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-500">
            <AlertCircle className="inline-block mr-2" />
            Connection Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
          <Button 
            onClick={fetchConnectionData} 
            variant="outline" 
            className="mt-4"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Connection Monitoring Dashboard
          </h2>
          <p className="text-muted-foreground">
            Advanced monitoring and diagnostics for your Shopify connection
          </p>
        </div>
        <Button 
          onClick={runConnectionTest} 
          disabled={isRunningTest}
          className="mt-2 sm:mt-0"
        >
          {isRunningTest ? 
            <>
              <span className="animate-spin mr-2">⟳</span> Testing...
            </> : 
            'Run Connection Test'
          }
        </Button>
      </div>

      {/* Health Score */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle>Connection Health</CardTitle>
            <Badge 
              variant={healthScore >= 80 ? "default" : healthScore >= 50 ? "outline" : "destructive"}
              className="ml-2"
            >
              {healthStatus.icon}
              <span className="ml-1">{healthStatus.label}</span>
            </Badge>
          </div>
          <CardDescription>
            Overall health status of your Shopify connection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Health Score</span>
              <span className="font-bold">{healthScore}%</span>
            </div>
            <Progress value={healthScore} className="h-2" />
          </div>
          
          {connectionData?.source?.connection_status !== 'connected' && (
            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-md">
              <AlertCircle className="inline-block mr-2" />
              Connection is currently {connectionData?.source?.connection_status}. 
              {connectionData?.source?.connection_error && (
                <span className="block mt-1 ml-6">Error: {connectionData.source.connection_error}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Dashboard Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid sm:grid-cols-5 grid-cols-2 h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">API Usage</TabsTrigger>
          <TabsTrigger value="limits">Rate Limits</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-4 space-y-6">
          <ConnectionHealthSummary 
            connectionData={connectionData} 
            onRefresh={fetchConnectionData}
          />
        </TabsContent>
        
        <TabsContent value="usage" className="mt-4 space-y-6">
          <ApiUsageChart metrics={connectionData?.metrics || []} />
        </TabsContent>
        
        <TabsContent value="limits" className="mt-4 space-y-6">
          <RateLimitMonitor 
            sourceId={sourceId} 
            metrics={connectionData?.metrics || []} 
          />
        </TabsContent>
        
        <TabsContent value="diagnostics" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Connection Diagnostics</CardTitle>
              <CardDescription>
                Detailed diagnostics and troubleshooting tools
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Recent Request Latency */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Request Latency</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={connectionData?.metrics?.slice().reverse() || []}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="created_at" 
                          tickFormatter={(time) => new Date(time).toLocaleTimeString()}
                        />
                        <YAxis 
                          label={{ value: 'Time (ms)', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip
                          formatter={(value) => [`${value} ms`, 'Execution Time']}
                          labelFormatter={(label) => new Date(label).toLocaleString()}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="execution_time_ms" 
                          name="Execution Time" 
                          stroke="#8884d8" 
                          activeDot={{ r: 8 }} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                {/* Network Path Testing */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Network Path Tests</h3>
                  <Button onClick={runConnectionTest} disabled={isRunningTest}>
                    Run Network Diagnostics
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="security" className="mt-4 space-y-6">
          <ConnectionSecurityAudit sourceId={sourceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConnectionMonitoringDashboard;
