
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
          <div className="space-y-4">
            <p className="font-medium">Supabase connection is not properly configured. This is required for connecting to Shopify.</p>
            
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md border border-red-200 dark:border-red-800">
              <h4 className="text-sm font-semibold mb-2">To fix this issue:</h4>
              <ol className="list-decimal pl-5 text-sm space-y-2">
                <li>Create a <code className="bg-red-100 dark:bg-red-900/40 px-1 py-0.5 rounded">.env</code> file in the root directory of your project</li>
                <li>Add the following environment variables:
                  <pre className="bg-red-100 dark:bg-red-900/40 p-2 rounded mt-1 overflow-x-auto">
                    <code>VITE_SUPABASE_URL=your_supabase_url</code>
                    <br />
                    <code>VITE_SUPABASE_ANON_KEY=your_supabase_anon_key</code>
                  </pre>
                </li>
                <li>Restart your development server</li>
              </ol>
            </div>
            
            <p className="text-sm text-muted-foreground">
              You can find these values in your Supabase project dashboard under Project Settings &gt; API.
            </p>
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
              onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
            >
              Open Supabase Dashboard
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default ConnectionErrorAlert;
