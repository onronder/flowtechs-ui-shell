
import { createClient } from 'https://esm.sh/@supabase/supabase-js@latest';
import { corsHeaders } from '../_shared/cors.ts';

// Define Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Handle OPTIONS requests for CORS
function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  return null;
}

// Retrieve source details
async function getSourceDetails(sourceId: string) {
  // Get source record
  const { data: source, error: sourceError } = await supabase
    .from('sources')
    .select('*')
    .eq('id', sourceId)
    .eq('type', 'shopify')
    .single();
  
  if (sourceError) {
    throw new Error(`Error fetching source: ${sourceError.message}`);
  }
  
  if (!source) {
    throw new Error('Source not found');
  }
  
  return source;
}

// Get access logs for a source
async function getAccessLogs(sourceId: string) {
  const { data: accessLogs, error: accessError } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('table_name', 'credential_access')
    .eq('record_id', sourceId)
    .order('created_at', { ascending: false });
  
  if (accessError) {
    throw new Error(`Error fetching access logs: ${accessError.message}`);
  }
  
  return accessLogs || [];
}

// Get API metrics for a source
async function getApiMetrics(sourceId: string) {
  const { data: metrics, error: metricsError } = await supabase
    .from('api_metrics')
    .select('*')
    .eq('source_id', sourceId)
    .order('created_at', { ascending: false })
    .limit(500);
  
  if (metricsError) {
    throw new Error(`Error fetching API metrics: ${metricsError.message}`);
  }
  
  return metrics || [];
}

// Analyze access patterns for unusual activity
function analyzeAccessPatterns(accessLogs: any[]) {
  // Group by user ID and count accesses
  const userAccessCounts: Record<string, number> = {};
  const userAccessTimes: Record<string, Date[]> = {};
  
  accessLogs.forEach(log => {
    const userId = log.user_id;
    userAccessCounts[userId] = (userAccessCounts[userId] || 0) + 1;
    
    if (!userAccessTimes[userId]) {
      userAccessTimes[userId] = [];
    }
    userAccessTimes[userId].push(new Date(log.created_at));
  });
  
  // Look for rapid access patterns (many accesses in a short time)
  const rapidAccessPatterns = Object.entries(userAccessTimes).map(([userId, times]) => {
    if (times.length < 5) return null; // Need at least 5 accesses to detect patterns
    
    // Sort times in ascending order
    times.sort((a, b) => a.getTime() - b.getTime());
    
    // Look for 5+ accesses within 1 minute
    for (let i = 4; i < times.length; i++) {
      const timeDiff = times[i].getTime() - times[i-4].getTime();
      if (timeDiff < 60000) { // 1 minute in milliseconds
        return {
          userId,
          rapid_access: true,
          access_count: 5,
          time_window_ms: timeDiff,
          first_access: times[i-4],
          last_access: times[i]
        };
      }
    }
    
    return null;
  }).filter(Boolean);
  
  // Analyze access times for unusual hour-of-day patterns
  const hourDistribution: number[] = new Array(24).fill(0);
  accessLogs.forEach(log => {
    const hour = new Date(log.created_at).getHours();
    hourDistribution[hour]++;
  });
  
  // Check for accesses during unusual hours (outside 6am-10pm)
  const unusualHourAccesses = accessLogs.filter(log => {
    const hour = new Date(log.created_at).getHours();
    return hour < 6 || hour > 22; // Outside normal business hours
  });
  
  // Check for multiple users accessing
  const multipleUserAccess = Object.keys(userAccessCounts).length > 1;
  
  return {
    total_access_count: accessLogs.length,
    unique_users: Object.keys(userAccessCounts).length,
    user_access_counts: userAccessCounts,
    rapid_access_patterns: rapidAccessPatterns,
    unusual_hour_accesses: unusualHourAccesses.length,
    multiple_user_access: multipleUserAccess,
    hour_distribution: hourDistribution
  };
}

// Analyze API usage for security concerns
function analyzeApiUsage(metrics: any[]) {
  // Calculate error rates
  const totalRequests = metrics.length;
  const failedRequests = metrics.filter(m => m.status_code >= 400).length;
  const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;
  
  // Look for rate limit issues
  const rateLimitIssues = metrics.filter(m => 
    m.rate_limit_available && 
    m.rate_limit_maximum && 
    (m.rate_limit_available / m.rate_limit_maximum < 0.1) // Less than 10% available
  );
  
  // Analyze request patterns by hour of day
  const hourDistribution: number[] = new Array(24).fill(0);
  metrics.forEach(m => {
    const hour = new Date(m.created_at).getHours();
    hourDistribution[hour]++;
  });
  
  // Check for unusual request volumes (spikes)
  const requestsByHour: Record<string, number> = {};
  metrics.forEach(m => {
    const dateHour = new Date(m.created_at).toISOString().substring(0, 13); // YYYY-MM-DDTHH
    requestsByHour[dateHour] = (requestsByHour[dateHour] || 0) + 1;
  });
  
  // Calculate average requests per hour
  const hourCounts = Object.values(requestsByHour);
  const avgRequestsPerHour = hourCounts.length > 0 
    ? hourCounts.reduce((sum, count) => sum + count, 0) / hourCounts.length 
    : 0;
  
  // Find spikes (hours with 3x average)
  const spikes = Object.entries(requestsByHour)
    .filter(([_, count]) => count > avgRequestsPerHour * 3)
    .map(([hour, count]) => ({ hour, count }));
  
  return {
    total_requests: totalRequests,
    error_rate: errorRate,
    rate_limit_issues: rateLimitIssues.length,
    hour_distribution: hourDistribution,
    avg_requests_per_hour: avgRequestsPerHour,
    request_spikes: spikes,
  };
}

// Check for credential age and security best practices
function analyzeCredentialSecurity(source: any) {
  const issues = [];
  const recommendations = [];
  
  // Check credential age
  const createdDate = new Date(source.created_at);
  const now = new Date();
  const credentialAgeInDays = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (credentialAgeInDays > 180) { // Older than 6 months
    issues.push({
      severity: 'high',
      issue: 'Access token is over 6 months old',
      details: 'Older tokens increase the security risk if compromised'
    });
    recommendations.push('Rotate your access token to improve security');
  } else if (credentialAgeInDays > 90) { // Older than 3 months
    issues.push({
      severity: 'medium',
      issue: 'Access token is over 3 months old',
      details: 'Consider periodic rotation of access tokens'
    });
    recommendations.push('Consider rotating your access token in the next month');
  }
  
  // Check for API version security
  if (!source.api_version) {
    issues.push({
      severity: 'medium',
      issue: 'API version not specified',
      details: 'Using an unspecified API version may lead to security issues'
    });
    recommendations.push('Specify a targeted API version for better security');
  } else {
    // Check if using latest API version
    const currentVersions = ['2024-04', '2024-01'];
    if (!currentVersions.includes(source.api_version)) {
      issues.push({
        severity: 'low',
        issue: 'Not using the latest API version',
        details: `Currently using version ${source.api_version}`
      });
      recommendations.push('Update to the latest API version for security fixes');
    }
  }
  
  // Calculate security score
  let securityScore = 100;
  
  issues.forEach(issue => {
    if (issue.severity === 'high') securityScore -= 20;
    else if (issue.severity === 'medium') securityScore -= 10;
    else securityScore -= 5;
  });
  
  return {
    credential_age_days: credentialAgeInDays,
    security_score: Math.max(0, securityScore),
    issues,
    recommendations,
  };
}

// Run the security audit
async function runSecurityAudit(sourceId: string) {
  try {
    // Get source details
    const source = await getSourceDetails(sourceId);
    
    // Get credential access logs
    const accessLogs = await getAccessLogs(sourceId);
    
    // Get API metrics
    const metrics = await getApiMetrics(sourceId);
    
    // Analyze access patterns
    const accessAnalysis = analyzeAccessPatterns(accessLogs);
    
    // Analyze API usage
    const apiAnalysis = analyzeApiUsage(metrics);
    
    // Analyze credential security
    const securityAnalysis = analyzeCredentialSecurity(source);
    
    // Generate comprehensive security report
    const report = {
      source_id: sourceId,
      source_name: source.name,
      timestamp: new Date().toISOString(),
      security_score: securityAnalysis.security_score,
      credential_age_days: securityAnalysis.credential_age_days,
      access_patterns: accessAnalysis,
      api_usage: apiAnalysis,
      issues: securityAnalysis.issues,
      recommendations: securityAnalysis.recommendations,
    };
    
    // Log the security audit
    await logSecurityAudit(sourceId, report);
    
    return {
      success: true,
      report,
    };
  } catch (error) {
    console.error('Error running security audit:', error);
    throw error;
  }
}

// Log security audit to the audit_logs table
async function logSecurityAudit(sourceId: string, report: any) {
  try {
    // Insert security audit log
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'security_audits',
        record_id: sourceId,
        action: 'security:audit',
        user_id: '00000000-0000-0000-0000-000000000000', // System user
        old_data: null,
        new_data: report,
      });
    
    if (error) {
      console.error('Error logging security audit:', error);
    }
  } catch (error) {
    console.error('Error in logSecurityAudit:', error);
  }
}

// Main request handler
Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  
  try {
    // Parse request body
    const { sourceId } = await req.json();
    
    if (!sourceId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Source ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Run security audit
    const result = await runSecurityAudit(sourceId);
    
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in connection-security-audit:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
