
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ConnectionErrorAlertProps {
  error: string;
  supabaseConfigured: boolean;
}

const ConnectionErrorAlert = ({ error, supabaseConfigured }: ConnectionErrorAlertProps) => {
  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle>Connection Error</AlertTitle>
      <AlertDescription className="mt-2">
        {!supabaseConfigured ? (
          <div className="space-y-2">
            <p>Supabase connection is not properly configured. This is required for connecting to Shopify.</p>
            <p className="text-sm text-muted-foreground">
              Please ensure that you have set up your Supabase environment variables:
            </p>
            <ul className="text-sm list-disc pl-5 text-muted-foreground">
              <li>VITE_SUPABASE_URL</li>
              <li>VITE_SUPABASE_ANON_KEY</li>
            </ul>
          </div>
        ) : (
          <div className="space-y-2">
            <p>{error}</p>
            <p className="text-sm text-muted-foreground">
              There was an error connecting to the Shopify API. Please check your credentials and try again.
            </p>
          </div>
        )}
        
        <div className="mt-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default ConnectionErrorAlert;
