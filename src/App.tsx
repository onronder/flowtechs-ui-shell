
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import AuthLayout from './layouts/AuthLayout';
import Dashboard from './pages/Dashboard';
import Sources from './pages/Sources';
import CustomQuery from './pages/CustomQuery';
import Datasets from './pages/Datasets';
import Destinations from './pages/Destinations';
import Jobs from './pages/Jobs';
import Transformations from './pages/Transformations';
import DataStorage from './pages/DataStorage';
import AIInsights from './pages/AIInsights';
import Settings from './pages/Settings';
import Help from './pages/Help';
import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import Verify from './pages/auth/Verify';
import NotFound from './pages/NotFound';
import Index from './pages/Index';
import './App.css';

function App() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="sources/*" element={<Sources />} />
        <Route path="datasets/*" element={<Datasets />} />
        <Route path="custom-query" element={<CustomQuery />} />
        <Route path="destinations/*" element={<Destinations />} />
        <Route path="jobs/*" element={<Jobs />} />
        <Route path="transformations/*" element={<Transformations />} />
        <Route path="storage/*" element={<DataStorage />} />
        <Route path="ai-insights/*" element={<AIInsights />} />
        <Route path="settings/*" element={<Settings />} />
        <Route path="help" element={<Help />} />
      </Route>
      <Route element={<AuthLayout />}>
        <Route path="auth">
          <Route path="signin" element={<SignIn />} />
          <Route path="signup" element={<SignUp />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="verify" element={<Verify />} />
        </Route>
      </Route>
      <Route path="/" element={<Index />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
