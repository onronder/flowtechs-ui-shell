import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase, getMetadataValue, type ShopifyApiVersion, type RateLimitInfo } from '@/integrations/supabase/client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertCircle, 
  ArrowLeft, 
  CheckCircle, 
  ExternalLink, 
  Key, 
  Lock, 
  RefreshCw, 
  ShieldCheck
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

const shopifySourceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  store_url: z.string().url("Please enter a valid URL").min(1, "Store URL is required"),
  api_key: z.string().min(1, "API key is required"),
  api_secret: z.string().min(1, "API secret is required"),
  access_token: z.string().min(1, "Access token is required"),
  api_version: z.enum(["2023-07", "2023-10", "2024-01", "2024-04"]),
  connection_timeout: z.string().min(1, "Connection timeout is required"),
  max_retries: z.string().min(1, "Max retries is required"),
  throttle_rate: z.string().min(1, "Throttle rate is required"),
  custom_headers: z.string().optional(),
});

type FormValues = z.infer<typeof shopifySourceSchema>;

export default function SourceForm() {
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<null | 'success' | 'error'>(null);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const form = useForm<FormValues>({
    resolver: zodResolver(shopifySourceSchema),
    defaultValues: {
      name: '',
      description: '',
      store_url: '',
      api_key: '',
      api_secret: '',
      access_token: '',
      api_version: '2024-04',
      connection_timeout: '30',
      max_retries: '3',
      throttle_rate: '2',
      custom_headers: '',
    }
  });

  useEffect(() => {
    if (isEditing) {
      fetchSourceData();
    }
  }, [isEditing]);

  const fetchSourceData = async () => {
    try {
      setLoading(true);
      
      const { data: sourceData, error: sourceError } = await supabase
        .from('sources')
        .select('*')
        .eq('id', id)
        .single();
      
      if (sourceError) throw sourceError;
      
      if (!sourceData) {
        navigate('/sources');
        throw new Error('Source not found');
      }
      
      const { data: credentials, error: credentialsError } = await supabase.functions.invoke('get-shopify-credentials', {
        body: { sourceId: id }
      });
      
      if (credentialsError) throw credentialsError;
      
      const metadata = sourceData.metadata || {};
      
      form.reset({
        name: sourceData.name,
        description: sourceData.description || '',
        store_url: credentials.store_url || '',
        api_key: credentials.api_key || '',
        api_secret: credentials.api_secret || '',
        access_token: credentials.access_token || '',
        api_version: (sourceData.api_version as ShopifyApiVersion) || '2024-04',
        connection_timeout: getMetadataValue<string>(metadata as Record<string, any>, 'connection_timeout', '30'),
        max_retries: getMetadataValue<string>(metadata as Record<string, any>, 'max_retries', '3'),
        throttle_rate: getMetadataValue<string>(metadata as Record<string, any>, 'throttle_rate', '2'),
        custom_headers: getMetadataValue<Record<string, any> | null>(metadata as Record<string, any>, 'custom_headers', null) 
          ? JSON.stringify(getMetadataValue<Record<string, any>>(metadata as Record<string, any>, 'custom_headers', {}), null, 2) 
          : '',
      });
      
      if (sourceData.connection_status === 'connected') {
        setConnectionStatus('success');
        setConnectionMessage('Connection to Shopify store is active');
      } else if (sourceData.connection_status === 'error') {
        setConnectionStatus('error');
        setConnectionMessage(sourceData.connection_error || 'Connection error');
      }
      
      const rateLimits = getMetadataValue<RateLimitInfo | null>(metadata as Record<string, any>, 'rate_limits', null);
      if (rateLimits) {
        setRateLimitInfo(rateLimits);
      }
      
    } catch (error) {
      console.error('Error fetching source data:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to load source data',
        description: 'Please try again later or contact support if the issue persists.'
      });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (values: FormValues) => {
    try {
      setTestingConnection(true);
      setConnectionStatus(null);
      setConnectionMessage('');
      
      let customHeaders = {};
      try {
        if (values.custom_headers) {
          customHeaders = JSON.parse(values.custom_headers);
        }
      } catch (error) {
        throw new Error('Invalid custom headers format. Please provide valid JSON.');
      }
      
      const { data, error } = await supabase.functions.invoke('test-shopify-connection', {
        body: {
          store_url: values.store_url,
          api_key: values.api_key,
          api_secret: values.api_secret,
          access_token: values.access_token,
          api_version: values.api_version,
          connection_timeout: parseInt(values.connection_timeout),
          max_retries: parseInt(values.max_retries),
          throttle_rate: parseInt(values.throttle_rate),
          custom_headers: customHeaders
        }
      });
      
      if (error) throw error;
      
      if (data.success) {
        setConnectionStatus('success');
        setConnectionMessage(data.message || 'Connection successful');
        
        if (data.rate_limits) {
          setRateLimitInfo(data.rate_limits as RateLimitInfo);
        }
        
        toast({
          title: 'Connection successful',
          description: 'Successfully connected to Shopify store.'
        });
      } else {
        setConnectionStatus('error');
        setConnectionMessage(data.message || 'Connection failed');
        
        toast({
          variant: 'destructive',
          title: 'Connection failed',
          description: data.message || 'Failed to connect to Shopify store.'
        });
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setConnectionStatus('error');
      setConnectionMessage((error as Error).message || 'Connection test failed.');
      
      toast({
        variant: 'destructive',
        title: 'Connection test failed',
        description: (error as Error).message || 'Please check your credentials and try again.'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      setLoading(true);
      
      let customHeaders = {};
      try {
        if (values.custom_headers) {
          customHeaders = JSON.parse(values.custom_headers);
        }
      } catch (error) {
        throw new Error('Invalid custom headers format. Please provide valid JSON.');
      }
      
      const metadata = {
        connection_timeout: parseInt(values.connection_timeout),
        max_retries: parseInt(values.max_retries),
        throttle_rate: parseInt(values.throttle_rate),
        custom_headers: customHeaders
      };
      
      const storeUrl = new URL(values.store_url);
      const storeName = storeUrl.hostname.split('.')[0];
      
      const { data, error } = await supabase.functions.invoke('save-shopify-source', {
        body: {
          id: isEditing ? id : undefined,
          name: values.name,
          description: values.description,
          store_url: values.store_url,
          store_name: storeName,
          api_key: values.api_key,
          api_secret: values.api_secret,
          access_token: values.access_token,
          api_version: values.api_version,
          metadata
        }
      });
      
      if (error) throw error;
      
      toast({
        title: isEditing ? 'Source updated' : 'Source created',
        description: isEditing 
          ? 'Your Shopify source has been updated successfully.' 
          : 'Your Shopify source has been created successfully.'
      });
      
      navigate('/sources');
    } catch (error) {
      console.error('Error saving source:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to save source',
        description: (error as Error).message || 'Please try again later or contact support if the issue persists.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/sources')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">
          {isEditing ? 'Edit Shopify Source' : 'Add New Shopify Source'}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader>
            <CardTitle>Shopify Source Details</CardTitle>
            <CardDescription>
              Connect to a Shopify store to import data for analysis and processing.
            </CardDescription>
          </CardHeader>
          
          <Tabs defaultValue="credentials" className="px-6">
            <TabsList className="mb-4">
              <TabsTrigger value="credentials">
                <Key className="mr-2 h-4 w-4" />
                Credentials
              </TabsTrigger>
              <TabsTrigger value="advanced">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Advanced Settings
              </TabsTrigger>
            </TabsList>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <TabsContent value="credentials">
                  <CardContent className="space-y-6 p-0">
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
                  </CardContent>
                </TabsContent>
                
                <TabsContent value="advanced">
                  <CardContent className="space-y-6 p-0">
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
                  </CardContent>
                </TabsContent>

                <CardFooter className="flex justify-between border-t pt-6 mt-6">
                  <div className="flex items-center">
                    {connectionStatus === 'success' && (
                      <div className="flex items-center text-sm text-green-600">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {connectionMessage}
                        
                        {rateLimitInfo && (
                          <span className="ml-4 text-xs bg-green-100 px-2 py-0.5 rounded-full">
                            Rate limit: {rateLimitInfo.available}/{rateLimitInfo.maximum}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {connectionStatus === 'error' && (
                      <div className="flex items-center text-sm text-red-600">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        {connectionMessage}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      type="button" 
                      variant="outline"
                      disabled={testingConnection || loading}
                      onClick={() => testConnection(form.getValues())}
                    >
                      {testingConnection && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                      Test Connection
                    </Button>
                    
                    <Button 
                      type="submit" 
                      disabled={loading || testingConnection}
                    >
                      {loading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                      {isEditing ? 'Update Source' : 'Save Source'}
                    </Button>
                  </div>
                </CardFooter>
              </form>
            </Form>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
