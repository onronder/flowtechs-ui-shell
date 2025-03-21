
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ApiMetric } from '../types/api-usage-types';
import { getOperationTypeData } from '../utils/metrics-processor';

interface OperationTypeChartProps {
  metrics: ApiMetric[];
}

const OperationTypeChart: React.FC<OperationTypeChartProps> = ({ metrics }) => {
  const operationChartData = getOperationTypeData(metrics);

  return (
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
  );
};

export default OperationTypeChart;
