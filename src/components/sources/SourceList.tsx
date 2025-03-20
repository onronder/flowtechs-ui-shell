
import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Source } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PlusCircle, RefreshCw, Trash2, Edit, ExternalLink, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SourceList() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sources')
        .select('*')
        .eq('type', 'shopify')
        .order('name');
      
      if (error) throw error;
      
      setSources(data || []);
    } catch (error) {
      console.error('Error fetching sources:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to load sources',
        description: 'Please try again later or contact support if the issue persists.'
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshConnection = async (sourceId: string) => {
    try {
      setRefreshing(prev => ({ ...prev, [sourceId]: true }));
      
      // Call edge function to test connection
      const { data, error } = await supabase.functions.invoke('check-shopify-connection', {
        body: { sourceId }
      });
      
      if (error) throw error;
      
      // Refresh sources list
      fetchSources();
      
      toast({
        title: 'Connection refreshed',
        description: data.message || 'Connection status has been updated.'
      });
    } catch (error) {
      console.error('Error refreshing connection:', error);
      toast({
        variant: 'destructive',
        title: 'Connection refresh failed',
        description: 'Unable to test connection. Please try again later.'
      });
    } finally {
      setRefreshing(prev => ({ ...prev, [sourceId]: false }));
    }
  };

  const deleteSource = async (sourceId: string) => {
    if (!confirm('Are you sure you want to delete this source? This action cannot be undone.')) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('sources')
        .delete()
        .eq('id', sourceId);
      
      if (error) throw error;
      
      setSources(sources.filter(source => source.id !== sourceId));
      
      toast({
        title: 'Source deleted',
        description: 'The source has been successfully deleted.'
      });
    } catch (error) {
      console.error('Error deleting source:', error);
      toast({
        variant: 'destructive',
        title: 'Deletion failed',
        description: 'Unable to delete the source. Please try again later.'
      });
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="text-green-500" />;
      case 'error':
        return <XCircle className="text-red-500" />;
      default:
        return <AlertCircle className="text-amber-500" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Shopify Sources</h2>
        <Button onClick={() => navigate('/sources/new')} className="whitespace-nowrap">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Source
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center my-8">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : sources.length === 0 ? (
        <div className="bg-muted rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-3">
          <div className="bg-primary/10 p-3 rounded-full">
            <ExternalLink className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-medium">No Shopify sources added yet</h3>
          <p className="text-muted-foreground max-w-sm">
            Connect to Shopify stores to start importing data for analysis and integration with other systems.
          </p>
          <Button onClick={() => navigate('/sources/new')} className="mt-4">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Your First Source
          </Button>
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Store</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead>Last Connected</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell className="font-medium">{source.name}</TableCell>
                  <TableCell>{source.store_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(source.connection_status)}
                      <span className="capitalize text-sm">
                        {source.connection_status || 'disconnected'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {source.last_connected_at ? (
                      <span className="text-sm">
                        {formatDistanceToNow(new Date(source.last_connected_at), { addSuffix: true })}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => refreshConnection(source.id)}
                        disabled={refreshing[source.id]}
                      >
                        <RefreshCw className={`h-4 w-4 ${refreshing[source.id] ? 'animate-spin' : ''}`} />
                        <span className="sr-only">Refresh</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => navigate(`/sources/edit/${source.id}`)}
                      >
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => deleteSource(source.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
