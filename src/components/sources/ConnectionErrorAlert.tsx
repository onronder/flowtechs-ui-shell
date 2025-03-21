
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ConnectionErrorAlertProps {
  error: string;
  supabaseConfigured: boolean;
}

const ConnectionErrorAlert = ({ error, supabaseConfigured }: ConnectionErrorAlertProps) => {
  const isEdgeFunctionError = error?.includes('Edge Function') || error?.includes('function') || error?.toLowerCase().includes('api');
  const isShopifyError = error?.toLowerCase().includes('shopify');
  
  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle>Connection Error</AlertTitle>
      <AlertDescription className="mt-2">
        {!supabaseConfigured ? (
          <div className="space-y-4">
            <p className="font-medium">Supabase connection is not properly configured. This is required for connecting to Shopify.</p>
            
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md border border-red-200 dark:border-red-800">
              <h4 className="text-sm font-semibold mb-2">To fix this issue:</h4>
              <ol className="list-decimal pl-5 text-sm space-y-2">
                <li>Create a <code className="bg-red-100 dark:bg-red-900/40 px-1 py-0.5 rounded">.env</code> file in the root directory of your project</li>
                <li>Add the following environment variables:
                  <pre className="bg-red-100 dark:bg-red-900/40 p-2 rounded mt-1 overflow-x-auto">
                    <code>VITE_SUPABASE_URL=https://bkhuqrzqbexmgpqbyiir.supabase.co</code>
                    <br />
                    <code>VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJraHVxcnpxYmV4bWdwcWJ5aWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI1MDk2OTcsImV4cCI6MjA1ODA4NTY5N30.BjVmX_zVq0kcRjFA1rBBgdZm3jp6kt_0N3AisXDS5FY</code>
                  </pre>
                </li>
                <li>Restart your development server</li>
              </ol>
            </div>
            
            <p className="text-sm text-muted-foreground">
              These values have been configured directly in the application for this session, but using environment variables is recommended for security and flexibility.
            </p>
          </div>
        ) : isEdgeFunctionError ? (
          <div className="space-y-2">
            <p className="font-medium">{error}</p>
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md border border-red-200 dark:border-red-800">
              <h4 className="text-sm font-semibold mb-2">This could be caused by:</h4>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>A temporary network issue connecting to the backend service</li>
                <li>Supabase edge function errors or timeouts</li>
                <li>An issue with the provided Shopify credentials</li>
              </ul>
              <p className="mt-2 text-sm">Please check your Shopify credentials and try again, or check the edge function logs for more details.</p>
            </div>
          </div>
        ) : isShopifyError ? (
          <div className="space-y-2">
            <p className="font-medium">{error}</p>
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md border border-red-200 dark:border-red-800">
              <h4 className="text-sm font-semibold mb-2">Common Shopify connection issues:</h4>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>Invalid access token or API key</li>
                <li>Incorrect store URL format (should be <code>your-store.myshopify.com</code>)</li>
                <li>API scopes may be insufficient for the requested operation</li>
                <li>The store may be password protected or not accessible</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p>{error}</p>
            <p className="text-sm text-muted-foreground">
              There was an error connecting to the Shopify API. Please check your credentials and try again.
            </p>
          </div>
        )}
        
        <div className="mt-4 flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </Button>
          
          {!supabaseConfigured && (
            <Button
              variant="default"
              size="sm"
              onClick={() => window.open('https://supabase.com/dashboard/project/bkhuqrzqbexmgpqbyiir/settings/api', '_blank')}
            >
              Open Supabase API Settings
            </Button>
          )}
          
          {isEdgeFunctionError && (
            <Button
              variant="default"
              size="sm"
              onClick={() => window.open('https://supabase.com/dashboard/project/bkhuqrzqbexmgpqbyiir/functions/save-shopify-source/logs', '_blank')}
            >
              View Edge Function Logs
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default ConnectionErrorAlert;
