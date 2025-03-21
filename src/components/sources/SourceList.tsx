
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
      
      setSources(data as unknown as Source[]);
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
      
      const { data, error } = await supabase.functions.invoke('check-shopify-connection', {
        body: { sourceId }
      });
      
      if (error) throw error;
      
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
    <div className="flex flex-col h-full">
      {loading ? (
        <div className="flex justify-center items-center flex-1 py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : sources.length === 0 ? (
        <div className="bg-muted/30 rounded-lg p-8 flex flex-col items-center justify-center text-center h-[calc(100vh-300px)] space-y-6">
          <div className="bg-primary/10 p-6 rounded-full">
            <ExternalLink className="h-12 w-12 text-primary" />
          </div>
          <div className="max-w-md">
            <h3 className="text-2xl font-medium mb-3">No Shopify sources added yet</h3>
            <p className="text-muted-foreground text-lg">
              Connect to Shopify stores to start importing data for analysis and integration with other systems.
            </p>
          </div>
          <Button 
            onClick={() => navigate('/sources/new')} 
            size="lg"
            className="mt-6"
          >
            <PlusCircle className="mr-2 h-5 w-5" />
            Add Your First Source
          </Button>
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Store</TableHead>
                <TableHead className="w-32">Status</TableHead>
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
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => refreshConnection(source.id)}
                        disabled={refreshing[source.id]}
                        className="h-8 px-2"
                      >
                        <RefreshCw className={`h-4 w-4 ${refreshing[source.id] ? 'animate-spin' : ''}`} />
                        <span className="sr-only">Refresh</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => navigate(`/sources/edit/${source.id}`)}
                        className="h-8 px-2"
                      >
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => deleteSource(source.id)}
                        className="h-8 px-2 text-destructive hover:text-destructive"
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
};
