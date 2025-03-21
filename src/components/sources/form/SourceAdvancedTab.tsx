
import React from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { UseFormReturn } from 'react-hook-form';
import { SourceFormValues } from './types';

interface SourceAdvancedTabProps {
  form: UseFormReturn<SourceFormValues>;
}

const SourceAdvancedTab: React.FC<SourceAdvancedTabProps> = ({ form }) => {
  return (
    <div className="space-y-6 p-0">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="api_version"
          render={({ field }) => (
            <FormItem>
              <FormLabel>API Version</FormLabel>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                {...field}
              >
                <option value="2023-07">2023-07</option>
                <option value="2023-10">2023-10</option>
                <option value="2024-01">2024-01</option>
                <option value="2024-04">2024-04</option>
              </select>
              <FormDescription>
                The Shopify API version to use
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="connection_timeout"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Connection Timeout (seconds)</FormLabel>
              <FormControl>
                <Input type="number" min="1" {...field} />
              </FormControl>
              <FormDescription>
                Maximum time to wait for a response
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="max_retries"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Max Retries</FormLabel>
              <FormControl>
                <Input type="number" min="0" max="10" {...field} />
              </FormControl>
              <FormDescription>
                Number of retry attempts for failed requests
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="throttle_rate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Throttle Rate (requests/second)</FormLabel>
              <FormControl>
                <Input type="number" min="0.1" step="0.1" {...field} />
              </FormControl>
              <FormDescription>
                Limit the number of requests per second
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <FormField
        control={form.control}
        name="custom_headers"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Custom Headers (JSON)</FormLabel>
            <FormControl>
              <Textarea 
                placeholder='{
  "X-Custom-Header": "value"
}'
                className="font-mono text-xs h-32"
                {...field} 
              />
            </FormControl>
            <FormDescription>
              Optional custom headers for API requests (JSON format)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};

export default SourceAdvancedTab;
