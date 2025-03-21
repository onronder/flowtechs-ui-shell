
import { Routes, Route } from 'react-router-dom';
import Index from '@/pages/Index';
import DashboardLayout from '@/layouts/DashboardLayout';
import Dashboard from '@/pages/Dashboard';
import Help from '@/pages/Help';
import NotFound from '@/pages/NotFound';
import Sources from '@/pages/Sources';
import Datasets from '@/pages/Datasets';
import Destinations from '@/pages/Destinations';
import AIInsights from '@/pages/AIInsights';
import Transformations from '@/pages/Transformations';
import Jobs from '@/pages/Jobs';
import DataStorage from '@/pages/DataStorage';
import Settings from '@/pages/Settings';
import CustomQuery from '@/pages/CustomQuery';
import EnterpriseVisualization from '@/pages/EnterpriseVisualization';
import ShopifyTestingPlan from '@/pages/ShopifyTestingPlan';

import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/sources" element={<Sources />} />
        <Route path="/datasets" element={<Datasets />} />
        <Route path="/destinations" element={<Destinations />} />
        <Route path="/transformations" element={<Transformations />} />
        <Route path="/ai-insights" element={<AIInsights />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/data-storage" element={<DataStorage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/help" element={<Help />} />
        <Route path="/custom-query" element={<CustomQuery />} />
        <Route path="/dataset/:id" element={<EnterpriseVisualization />} />
        <Route path="/shopify-testing" element={<ShopifyTestingPlan />} />
      </Route>
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
