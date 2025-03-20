
import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { AlertCircle, CheckCircle, History, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConnectionLog {
  id: string;
  source_id: string;
  source_name: string;
  event_type: 'connection' | 'auth' | 'error';
  status: 'success' | 'error';
  message: string;
  metadata: Record<string, any>;
  created_at: string;
}

export default function ConnectionLogView() {
  const [logs, setLogs] = useState<ConnectionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchConnectionLogs();
  }, []);

  const fetchConnectionLogs = async () => {
    try {
      setLoading(true);
      
      // Call edge function to get connection logs
      const { data, error } = await supabase.functions.invoke('get-connection-logs', {
        body: { limit: 50 }
      });
      
      if (error) throw error;
      
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching connection logs:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to load connection logs',
        description: 'Please try again later.'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="text-green-500" />;
      case 'error':
        return <XCircle className="text-red-500" />;
      default:
        return <AlertCircle className="text-amber-500" />;
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'connection':
        return <RefreshCw className="text-blue-500" />;
      case 'auth':
        return <CheckCircle className="text-green-500" />;
      case 'error':
        return <AlertCircle className="text-red-500" />;
      default:
        return <History className="text-gray-500" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Connection Activity</h2>
        <Button onClick={fetchConnectionLogs} variant="outline" size="sm">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center my-8">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : logs.length === 0 ? (
        <div className="border rounded-lg p-8 flex flex-col items-center justify-center text-center space-y-3">
          <h3 className="text-lg font-medium">No connection activity yet</h3>
          <p className="text-muted-foreground max-w-md">
            Connection logs will appear here once you've established connections with your Shopify sources.
          </p>
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-[100px]">Event Type</TableHead>
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs">
                    {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                  </TableCell>
                  <TableCell>{log.source_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getEventTypeIcon(log.event_type)}
                      <span className="capitalize text-sm">
                        {log.event_type}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(log.status)}
                      <span className="sr-only">{log.status}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.message}
                    
                    {log.metadata?.rate_limit && (
                      <span className="ml-2 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        Rate: {log.metadata.rate_limit.available}/{log.metadata.rate_limit.total}
                      </span>
                    )}
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
