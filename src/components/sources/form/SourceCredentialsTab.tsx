
import React from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Lock, ExternalLink } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { SourceFormValues } from './types';

interface SourceCredentialsTabProps {
  form: UseFormReturn<SourceFormValues>;
}

const SourceCredentialsTab: React.FC<SourceCredentialsTabProps> = ({ form }) => {
  return (
    <div className="space-y-6 p-0">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Source Name</FormLabel>
              <FormControl>
                <Input placeholder="My Shopify Store" {...field} />
              </FormControl>
              <FormDescription>
                A friendly name to identify this source
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="store_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Shopify Store URL</FormLabel>
              <FormControl>
                <Input placeholder="https://my-store.myshopify.com" {...field} />
              </FormControl>
              <FormDescription>
                The URL of your Shopify store
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea 
                placeholder="Optional description for this source" 
                className="resize-none" 
                {...field} 
              />
            </FormControl>
            <FormDescription>
              Additional notes about this source
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="border p-4 rounded-md bg-muted/30">
        <div className="flex items-center mb-3">
          <Lock className="h-4 w-4 mr-2 text-muted-foreground" />
          <h3 className="font-medium">Shopify API Credentials</h3>
        </div>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="api_key"
            render={({ field }) => (
              <FormItem>
                <FormLabel>API Key</FormLabel>
                <FormControl>
                  <Input placeholder="d8fg7e6r5..." type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="api_secret"
            render={({ field }) => (
              <FormItem>
                <FormLabel>API Secret</FormLabel>
                <FormControl>
                  <Input placeholder="shpss_..." type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="sm:col-span-2">
            <FormField
              control={form.control}
              name="access_token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Access Token</FormLabel>
                  <FormControl>
                    <Input placeholder="shpat_..." type="password" {...field} />
                  </FormControl>
                  <FormDescription>
                    <a 
                      href="https://shopify.dev/docs/apps/auth/admin-app-access-tokens" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs text-blue-600 hover:underline"
                    >
                      How to get your access token
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SourceCredentialsTab;
