
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiMetric } from '../types/api-usage-types';
import { generateMetricsSummary } from '../utils/metrics-processor';

interface SummaryCardsProps {
  metrics: ApiMetric[];
}

const SummaryCards: React.FC<SummaryCardsProps> = ({ metrics }) => {
  const { totalRequests, successfulRequests, failedRequests, successRate, avgResponseTime } = 
    generateMetricsSummary(metrics);

  return (
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
            {avgResponseTime.toFixed(0)} ms
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SummaryCards;
