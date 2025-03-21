
import { Routes, Route, Navigate } from 'react-router-dom';
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
import NewSource from '@/pages/NewSource';
import AuthLayout from '@/layouts/AuthLayout';
import SignIn from '@/pages/auth/SignIn';
import SignUp from '@/pages/auth/SignUp';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import ResetPassword from '@/pages/auth/ResetPassword';
import Verify from '@/pages/auth/Verify';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Toaster } from '@/components/ui/toaster';

import './App.css';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Index />} />
        
        <Route path="/auth" element={<AuthLayout />}>
          <Route path="signin" element={<SignIn />} />
          <Route path="signup" element={<SignUp />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="verify" element={<Verify />} />
        </Route>
        
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/sources" element={<Sources />} />
            <Route path="/sources/new" element={<NewSource />} />
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
        </Route>
        
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
