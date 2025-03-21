
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Shield, AlertTriangle, CheckCircle, RefreshCw, Key, Clock } from "lucide-react";
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

interface ConnectionSecurityAuditProps {
  sourceId: string;
}

const ConnectionSecurityAudit: React.FC<ConnectionSecurityAuditProps> = ({ sourceId }) => {
  const [securityData, setSecurityData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  
  useEffect(() => {
    fetchSecurityData();
  }, [sourceId]);
  
  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      // Fetch source data
      const { data: source, error: sourceError } = await supabase
        .from('sources')
        .select('*, audit_logs(*)')
        .eq('id', sourceId)
        .single();
      
      if (sourceError) throw sourceError;
      
      // Get access logs for this source
      const { data: accessLogs, error: accessError } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('table_name', 'credential_access')
        .eq('record_id', sourceId)
        .order('created_at', { ascending: false });
      
      if (accessError) throw accessError;
      
      // Generate security assessment
      const securityAssessment = assessSecurity(source, accessLogs || []);
      
      setSecurityData({
        source,
        accessLogs: accessLogs || [],
        assessment: securityAssessment
      });
    } catch (error) {
      console.error("Error fetching security data:", error);
      toast({
        title: "Error",
        description: "Failed to load security audit data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  const runSecurityAudit = async () => {
    setIsRunningAudit(true);
    try {
      // Call the security audit edge function
      const response = await supabase.functions.invoke('connection-security-audit', {
        body: { sourceId }
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      toast({
        title: "Security Audit Complete",
        description: "Security assessment has been updated",
      });
      
      // Refresh data
      fetchSecurityData();
    } catch (error) {
      toast({
        title: "Audit Failed",
        description: error instanceof Error ? error.message : "Failed to run security audit",
        variant: "destructive"
      });
    } finally {
      setIsRunningAudit(false);
    }
  };
  
  const assessSecurity = (source: any, accessLogs: any[]) => {
    // Default values for assessment
    const assessment = {
      securityScore: 0,
      credentialAge: 0,
      credentialHealth: 'unknown',
      unusualAccess: false,
      vulnerabilities: [],
      recommendations: [],
    };
    
    if (!source) return assessment;
    
    // Calculate credential age (in days)
    const createdDate = new Date(source.created_at);
    const now = new Date();
    assessment.credentialAge = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Security rating based on various factors
    let score = 100;
    
    // Access token age affects score
    if (assessment.credentialAge > 180) { // Older than 6 months
      score -= 20;
      assessment.vulnerabilities.push({
        severity: 'high',
        issue: 'Access token is over 6 months old',
        details: 'Older tokens increase the security risk if compromised'
      });
      assessment.recommendations.push('Rotate your access token to improve security');
    } else if (assessment.credentialAge > 90) { // Older than 3 months
      score -= 10;
      assessment.vulnerabilities.push({
        severity: 'medium',
        issue: 'Access token is over 3 months old',
        details: 'Consider periodic rotation of access tokens'
      });
      assessment.recommendations.push('Consider rotating your access token in the next month');
    }
    
    // Check for unusual access patterns
    const recentAccessLogs = accessLogs.slice(0, 20);
    const accessCounts = {};
    
    recentAccessLogs.forEach(log => {
      const userId = log.user_id;
      accessCounts[userId] = (accessCounts[userId] || 0) + 1;
    });
    
    // Check if there are multiple users accessing this source's credentials
    const userIds = Object.keys(accessCounts);
    if (userIds.length > 1) {
      assessment.unusualAccess = true;
      score -= 15;
      assessment.vulnerabilities.push({
        severity: 'medium',
        issue: 'Multiple users accessing credentials',
        details: `${userIds.length} different users have accessed this source's credentials recently`
      });
      assessment.recommendations.push('Review user access permissions and limit credential access');
    }
    
    // Check API version
    if (!source.api_version) {
      score -= 5;
      assessment.vulnerabilities.push({
        severity: 'low',
        issue: 'API version not specified',
        details: 'Using an unspecified API version may lead to unexpected issues'
      });
      assessment.recommendations.push('Specify a targeted API version for more predictable behavior');
    } else {
      // Check if using latest API version
      const currentVersions = ['2024-04', '2024-01'];
      if (!currentVersions.includes(source.api_version)) {
        score -= 5;
        assessment.vulnerabilities.push({
          severity: 'low',
          issue: 'Not using the latest API version',
          details: `Currently using version ${source.api_version}`
        });
        assessment.recommendations.push('Update to the latest API version when possible');
      }
    }
    
    // Set credential health based on score
    if (score >= 80) {
      assessment.credentialHealth = 'good';
    } else if (score >= 50) {
      assessment.credentialHealth = 'fair';
    } else {
      assessment.credentialHealth = 'poor';
    }
    
    // Add some default recommendations if none exist
    if (assessment.recommendations.length === 0) {
      assessment.recommendations.push('Set up monitoring alerts for unusual access patterns');
      assessment.recommendations.push('Implement regular credential rotation as a security best practice');
    }
    
    assessment.securityScore = Math.max(0, Math.min(100, score));
    
    return assessment;
  };
  
  if (loading && !securityData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!securityData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-yellow-500">
            <AlertTriangle className="inline-block mr-2" />
            Security Data Unavailable
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Could not load security data for this connection.</p>
          <Button 
            onClick={fetchSecurityData} 
            variant="outline" 
            className="mt-4"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  const { assessment, accessLogs, source } = securityData;

  return (
    <div className="space-y-6">
      {/* Security Score */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Security Assessment</CardTitle>
            <Button 
              onClick={runSecurityAudit} 
              variant="outline" 
              size="sm" 
              disabled={isRunningAudit}
            >
              {isRunningAudit ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Run Audit
                </>
              )}
            </Button>
          </div>
          <CardDescription>
            Security health assessment for this connection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center mb-4">
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <circle 
                  cx="50" 
                  cy="50" 
                  r="45" 
                  fill="none" 
                  stroke="currentColor" 
                  className="text-muted stroke-[5]" 
                />
                <circle 
                  cx="50" 
                  cy="50" 
                  r="45" 
                  fill="none" 
                  stroke="currentColor" 
                  className={`
                    ${assessment.securityScore >= 80 ? 'text-green-500' : ''}
                    ${assessment.securityScore >= 50 && assessment.securityScore < 80 ? 'text-yellow-500' : ''}
                    ${assessment.securityScore < 50 ? 'text-red-500' : ''}
                    stroke-[5]
                  `}
                  strokeDasharray={`${assessment.securityScore * 2.83} 283`}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">{assessment.securityScore}</span>
                <span className="text-sm text-muted-foreground">Security Score</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="p-4 border rounded-md">
              <div className="flex items-center">
                <Key className="h-5 w-5 mr-2 text-blue-500" />
                <span className="font-medium">Credential Age</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {assessment.credentialAge} days
              </p>
              <p className="text-sm text-muted-foreground">
                Created {format(new Date(source.created_at), 'MMM dd, yyyy')}
              </p>
            </div>
            
            <div className="p-4 border rounded-md">
              <div className="flex items-center">
                <Shield className="h-5 w-5 mr-2 text-blue-500" />
                <span className="font-medium">Credential Health</span>
              </div>
              <div className="flex items-center mt-1">
                <span className="text-2xl font-bold capitalize">
                  {assessment.credentialHealth}
                </span>
                <Badge 
                  variant={
                    assessment.credentialHealth === 'good' ? 'default' : 
                    assessment.credentialHealth === 'fair' ? 'secondary' : 
                    'destructive'
                  }
                  className="ml-2"
                >
                  {assessment.credentialHealth === 'good' ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 mr-1" />
                  )}
                  {assessment.credentialHealth === 'good' ? 'Secure' : 
                   assessment.credentialHealth === 'fair' ? 'Warning' : 
                   'At Risk'}
                </Badge>
              </div>
            </div>
          </div>
          
          {/* Vulnerabilities */}
          {assessment.vulnerabilities.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium mb-2">Detected Vulnerabilities</h3>
              <div className="space-y-2">
                {assessment.vulnerabilities.map((vulnerability, idx) => (
                  <div key={idx} className="border rounded-md p-3">
                    <div className="flex items-center">
                      <Badge 
                        variant={
                          vulnerability.severity === 'high' ? 'destructive' : 
                          vulnerability.severity === 'medium' ? 'secondary' : 
                          'outline'
                        }
                        className="capitalize"
                      >
                        {vulnerability.severity}
                      </Badge>
                      <span className="ml-2 font-medium">{vulnerability.issue}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {vulnerability.details}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Security Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Security Recommendations</CardTitle>
          <CardDescription>
            Actionable steps to improve connection security
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assessment.recommendations.length > 0 ? (
            <ul className="space-y-2">
              {assessment.recommendations.map((recommendation, idx) => (
                <li key={idx} className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 shrink-0" />
                  <span>{recommendation}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No recommendations available</p>
          )}
        </CardContent>
      </Card>
      
      {/* Access Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Credential Access Logs</CardTitle>
          <CardDescription>
            Recent access to this connection's credentials
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accessLogs.length > 0 ? (
            <div className="space-y-4">
              {accessLogs.slice(0, 10).map((log, idx) => (
                <div key={idx} className="flex justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium">
                      {log.new_data?.source_name || 'Unknown source'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatActionName(log.action)} by User ID: {truncateUserId(log.user_id)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No recent credential access logs</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Helper functions
function formatActionName(action: string): string {
  return action
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function truncateUserId(userId: string): string {
  if (!userId) return 'Unknown';
  return userId.substring(0, 8) + '...';
}

export default ConnectionSecurityAudit;
