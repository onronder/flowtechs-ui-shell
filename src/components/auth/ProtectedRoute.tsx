
import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const ProtectedRoute: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // Check for authentication and loading state
  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If not authenticated, redirect to sign-in page with the return URL
  if (!user) {
    return <Navigate to="/auth/signin" state={{ from: location.pathname }} replace />;
  }

  // If authenticated, render the child routes
  return <Outlet />;
};
