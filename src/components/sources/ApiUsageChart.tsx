
import React, { useState } from 'react';
import { ApiUsageChartProps } from './types/api-usage-types';
import SummaryCards from './charts/SummaryCards';
import UsageTrendChart from './charts/UsageTrendChart';
import OperationTypeChart from './charts/OperationTypeChart';

const ApiUsageChart: React.FC<ApiUsageChartProps> = ({ metrics }) => {
  const [timePeriod, setTimePeriod] = useState('daily');
  
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <SummaryCards metrics={metrics} />
      
      {/* Trending Charts */}
      <UsageTrendChart 
        metrics={metrics} 
        timePeriod={timePeriod} 
        setTimePeriod={setTimePeriod} 
      />
      
      {/* Operation Type Distribution */}
      <OperationTypeChart metrics={metrics} />
    </div>
  );
};

export default ApiUsageChart;
