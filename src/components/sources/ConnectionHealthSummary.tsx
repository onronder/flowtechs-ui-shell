
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertCircle, CheckCircle, RefreshCw, Zap } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';

interface ConnectionHealthSummaryProps {
  connectionData: any;
  onRefresh: () => void;
}

const ConnectionHealthSummary: React.FC<ConnectionHealthSummaryProps> = ({ 
  connectionData, 
  onRefresh 
}) => {
  if (!connectionData) return null;
  
  const { source, metrics } = connectionData;
  
  // Calculate error rate from metrics
  const totalRequests = metrics.length;
  const failedRequests = metrics.filter(m => m.status_code >= 400).length;
  const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;
  
  // Get average response time
  const avgResponseTime = metrics.length > 0 
    ? metrics.reduce((sum, m) => sum + (m.execution_time_ms || 0), 0) / metrics.length 
    : 0;
  
  // Get last connection time
  const lastConnected = source.last_connected_at 
    ? formatDistanceToNow(new Date(source.last_connected_at), { addSuffix: true })
    : 'Never';
  
  // Check API version compatibility
  const apiVersionOutdated = isApiVersionOutdated(source.api_version);
  
  // Calculate health indicators
  const indicators = [
    {
      name: "Connection Status",
      value: source.connection_status === 'connected' ? 'Connected' : 'Disconnected',
      status: source.connection_status === 'connected' ? 'success' : 'error',
      icon: source.connection_status === 'connected' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />
    },
    {
      name: "Error Rate",
      value: `${errorRate.toFixed(1)}%`,
      status: errorRate < 5 ? 'success' : errorRate < 15 ? 'warning' : 'error',
      icon: <AlertCircle className="h-5 w-5" />
    },
    {
      name: "Avg Response Time",
      value: `${avgResponseTime.toFixed(0)} ms`,
      status: avgResponseTime < 300 ? 'success' : avgResponseTime < 1000 ? 'warning' : 'error',
      icon: <Clock className="h-5 w-5" />
    },
    {
      name: "API Version",
      value: source.api_version || 'Unknown',
      status: apiVersionOutdated ? 'warning' : 'success',
      icon: <Zap className="h-5 w-5" />
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Connection Summary</CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRefresh}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
          <CardDescription>
            Last connected {lastConnected}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {indicators.map((indicator) => (
              <div 
                key={indicator.name} 
                className="flex items-center justify-between p-4 rounded-lg border"
              >
                <div className="flex items-center">
                  <div className={`mr-3 ${getColorForStatus(indicator.status)}`}>
                    {indicator.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{indicator.name}</p>
                    <p className="text-2xl font-bold">{indicator.value}</p>
                  </div>
                </div>
                <Badge 
                  variant={getBadgeVariantForStatus(indicator.status)}
                  className="ml-auto"
                >
                  {getStatusText(indicator.status)}
                </Badge>
              </div>
            ))}
          </div>
          
          {/* Recent connection events */}
          <div className="mt-6">
            <h3 className="font-medium mb-2">Recent Connection Events</h3>
            <div className="space-y-2">
              {source.audit_logs && source.audit_logs.length > 0 ? (
                source.audit_logs
                  .filter(log => log.action.startsWith('connection:'))
                  .slice(0, 5)
                  .map((log, i) => (
                    <div key={i} className="text-sm p-2 border rounded">
                      <div className="flex justify-between">
                        <span className={`${log.action.includes(':error') ? 'text-red-500' : 'text-green-500'}`}>
                          {formatActionName(log.action)}
                        </span>
                        <span className="text-muted-foreground">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {log.new_data?.message && (
                        <p className="mt-1 text-muted-foreground">{log.new_data.message}</p>
                      )}
                    </div>
                  ))
              ) : (
                <p className="text-muted-foreground text-sm">No recent connection events</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Quick Tips and Actionable Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Insights</CardTitle>
          <CardDescription>
            Actionable recommendations to improve connection reliability
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {generateInsights(connectionData).map((insight, i) => (
              <li key={i} className="flex">
                <div className={`mr-3 mt-0.5 ${getColorForStatus(insight.severity)}`}>
                  {insight.severity === 'error' ? (
                    <AlertCircle className="h-5 w-5" />
                  ) : insight.severity === 'warning' ? (
                    <AlertCircle className="h-5 w-5" />
                  ) : (
                    <CheckCircle className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p>{insight.message}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

// Helper functions
function isApiVersionOutdated(version?: string): boolean {
  if (!version) return true;
  
  // Example logic - would need to be updated as Shopify releases new API versions
  const currentVersions = ['2024-04', '2024-01'];
  return !currentVersions.includes(version);
}

function getColorForStatus(status: string): string {
  switch (status) {
    case 'success': return 'text-green-500';
    case 'warning': return 'text-yellow-500';
    case 'error': return 'text-red-500';
    default: return 'text-gray-500';
  }
}

function getBadgeVariantForStatus(status: string): "default" | "destructive" | "outline" | "secondary" {
  switch (status) {
    case 'success': return 'default';
    case 'warning': return 'secondary';
    case 'error': return 'destructive';
    default: return 'outline';
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'success': return 'Good';
    case 'warning': return 'Warning';
    case 'error': return 'Critical';
    default: return 'Unknown';
  }
}

function formatActionName(action: string): string {
  return action
    .replace('connection:', '')
    .replace(':', ' ')
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function generateInsights(connectionData: any): Array<{severity: string, message: string}> {
  const insights = [];
  const { source, metrics } = connectionData;
  
  // Check connection status
  if (source.connection_status !== 'connected') {
    insights.push({
      severity: 'error',
      message: `Connection is currently ${source.connection_status}. Please check your credentials and try reconnecting.`
    });
  }
  
  // Check API version
  if (isApiVersionOutdated(source.api_version)) {
    insights.push({
      severity: 'warning',
      message: `Your API version (${source.api_version}) might be outdated. Consider upgrading to the latest version for new features and security improvements.`
    });
  }
  
  // Check error rate
  const totalRequests = metrics.length;
  const failedRequests = metrics.filter(m => m.status_code >= 400).length;
  const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;
  
  if (errorRate > 10) {
    insights.push({
      severity: 'error',
      message: `High error rate detected (${errorRate.toFixed(1)}%). Examine recent errors to identify and fix the root cause.`
    });
  }
  
  // Check rate limits
  const highRateLimitUsage = metrics.some(m => 
    m.rate_limit_available && m.rate_limit_maximum && 
    (m.rate_limit_available / m.rate_limit_maximum < 0.2)
  );
  
  if (highRateLimitUsage) {
    insights.push({
      severity: 'warning',
      message: 'Rate limit usage is high. Consider optimizing queries or implementing request throttling.'
    });
  }
  
  // Check for slow responses
  const avgResponseTime = metrics.length > 0 
    ? metrics.reduce((sum, m) => sum + (m.execution_time_ms || 0), 0) / metrics.length 
    : 0;
  
  if (avgResponseTime > 1000) {
    insights.push({
      severity: 'warning',
      message: `Slow average response time (${avgResponseTime.toFixed(0)}ms). Consider optimizing your queries or checking for network issues.`
    });
  }
  
  // Add a positive insight if everything looks good
  if (insights.length === 0) {
    insights.push({
      severity: 'success',
      message: 'Your connection is healthy and operating optimally. Continue monitoring for any changes.'
    });
  }
  
  return insights;
}

export default ConnectionHealthSummary;
