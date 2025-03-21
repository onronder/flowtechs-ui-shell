
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase, getMetadataValue, type ShopifyApiVersion, type RateLimitInfo } from '@/integrations/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { shopifySourceSchema, SourceFormValues, TestConnectionResult } from './types';

export const useSourceFormLogic = () => {
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<null | 'success' | 'error'>(null);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  // Check if Supabase is properly configured
  useEffect(() => {
    // We're now using hardcoded values in the client, so we always consider it configured
    setIsSupabaseConfigured(true);
    
    // Test the connection to make sure it works
    (async () => {
      try {
        const { error } = await supabase.from('sources').select('count').limit(1);
        if (error) {
          console.error('Supabase connection test failed:', error);
          setIsSupabaseConfigured(false);
          setConnectionError('Unable to connect to Supabase. The API key may be incorrect or lacks sufficient permissions.');
        }
      } catch (error) {
        console.error('Error testing Supabase connection:', error);
        setIsSupabaseConfigured(false);
        setConnectionError('Unable to connect to Supabase. Please check your network connection.');
      }
    })();
  }, []);

  const form = useForm<SourceFormValues>({
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
    if (!isSupabaseConfigured) {
      return;
    }
    
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
      setConnectionError('Failed to load source data');
      toast({
        variant: 'destructive',
        title: 'Failed to load source data',
        description: 'Please try again later or contact support if the issue persists.'
      });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (values: SourceFormValues) => {
    if (!isSupabaseConfigured) {
      setConnectionError('Supabase connection is not properly configured');
      return;
    }
    
    try {
      setTestingConnection(true);
      setConnectionStatus(null);
      setConnectionMessage('');
      setConnectionError(null);
      
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
      
      const result = data as TestConnectionResult;
      
      if (result.success) {
        setConnectionStatus('success');
        setConnectionMessage(result.message || 'Connection successful');
        
        if (result.rate_limits) {
          setRateLimitInfo(result.rate_limits as RateLimitInfo);
        }
        
        toast({
          title: 'Connection successful',
          description: 'Successfully connected to Shopify store.'
        });
      } else {
        setConnectionStatus('error');
        setConnectionMessage(result.message || 'Connection failed');
        
        toast({
          variant: 'destructive',
          title: 'Connection failed',
          description: result.message || 'Failed to connect to Shopify store.'
        });
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setConnectionStatus('error');
      setConnectionMessage((error as Error).message || 'Connection test failed.');
      setConnectionError((error as Error).message || 'Connection test failed');
      
      toast({
        variant: 'destructive',
        title: 'Connection test failed',
        description: (error as Error).message || 'Please check your credentials and try again.'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const onSubmit = async (values: SourceFormValues) => {
    if (!isSupabaseConfigured) {
      setConnectionError('Supabase connection is not properly configured');
      return;
    }
    
    try {
      setLoading(true);
      setConnectionError(null);
      
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
      setConnectionError((error as Error).message || 'Failed to save source');
      
      toast({
        variant: 'destructive',
        title: 'Failed to save source',
        description: (error as Error).message || 'Please try again later or contact support if the issue persists.'
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    form,
    loading,
    testingConnection,
    connectionStatus,
    connectionMessage,
    rateLimitInfo,
    isEditing,
    navigate,
    testConnection,
    onSubmit,
    connectionError,
    isSupabaseConfigured
  };
};
