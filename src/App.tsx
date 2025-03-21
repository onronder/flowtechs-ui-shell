
import { Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import DashboardLayout from "./layouts/DashboardLayout";
import AuthLayout from "./layouts/AuthLayout";

import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Sources from "./pages/Sources";
import Datasets from "./pages/Datasets";
import DataStorage from "./pages/DataStorage";
import Destinations from "./pages/Destinations";
import Jobs from "./pages/Jobs";
import Transformations from "./pages/Transformations";
import AIInsights from "./pages/AIInsights";
import Settings from "./pages/Settings";
import Help from "./pages/Help";
import CustomQuery from "./pages/CustomQuery";
import EnterpriseVisualization from "./pages/EnterpriseVisualization";
import NotFound from "./pages/NotFound";

import SignIn from "./pages/auth/SignIn";
import SignUp from "./pages/auth/SignUp";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import Verify from "./pages/auth/Verify";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route path="/" element={<Index />} />
        
        <Route path="/auth" element={<AuthLayout />}>
          <Route path="signin" element={<SignIn />} />
          <Route path="signup" element={<SignUp />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="verify" element={<Verify />} />
        </Route>
        
        <Route path="/" element={<DashboardLayout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="sources/*" element={<Sources />} />
          <Route path="datasets/*" element={<Datasets />} />
          <Route path="visualization/:id" element={<EnterpriseVisualization />} />
          <Route path="data-storage" element={<DataStorage />} />
          <Route path="destinations" element={<Destinations />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="transformations" element={<Transformations />} />
          <Route path="ai-insights" element={<AIInsights />} />
          <Route path="settings" element={<Settings />} />
          <Route path="help" element={<Help />} />
          <Route path="custom-query" element={<CustomQuery />} />
        </Route>
        
        <Route path="*" element={<NotFound />} />
      </Routes>
      
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;
