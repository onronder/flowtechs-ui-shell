import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format, formatDistanceStrict } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface ExtractionLog {
  id: string;
  dataset_id: string;
  start_time: string;
  end_time: string | null;
  status: string;
  records_processed: number;
  total_records: number | null;
  error_message: string | null;
  api_calls: number;
  average_response_time: number | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

interface DatasetHistoryProps {
  datasetId: string;
}

const DatasetHistory = ({ datasetId }: DatasetHistoryProps) => {
  const [logs, setLogs] = useState<ExtractionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    fetchLogs();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'extraction_logs',
          filter: `dataset_id=eq.${datasetId}`
        },
        () => {
          fetchLogs();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [datasetId]);
  
  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('extraction_logs')
        .select('*')
        .eq('dataset_id', datasetId)
        .order('start_time', { ascending: false });
        
      if (error) throw error;
      
      setLogs(data as ExtractionLog[]);
    } catch (error) {
      console.error('Error fetching extraction logs:', error);
      toast({
        variant: "destructive",
        title: "Failed to load history",
        description: "There was an error loading the extraction history."
      });
    } finally {
      setLoading(false);
    }
  };
  
  const formatDuration = (startTime: string, endTime: string | null) => {
    if (!endTime) return 'In progress';
    
    return formatDistanceStrict(new Date(startTime), new Date(endTime), { addSuffix: false });
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'running':
        return <Badge className="bg-blue-500">Running</Badge>;
      case 'failed':
        return <Badge className="bg-red-500">Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Extraction History</CardTitle>
          <CardDescription>Loading history data...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Extraction History</CardTitle>
          <CardDescription>No extraction history found</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This dataset doesn't have any extraction history yet. Run an extraction to see the history.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Extraction History</CardTitle>
        <CardDescription>View previous extraction runs and results</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Records</TableHead>
              <TableHead>API Calls</TableHead>
              <TableHead>Response Time</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  {format(new Date(log.start_time), "MMM d, yyyy HH:mm:ss")}
                </TableCell>
                <TableCell>{getStatusBadge(log.status)}</TableCell>
                <TableCell>
                  {log.status === 'running' ? (
                    <div className="flex items-center">
                      <Loader2 className="h-3 w-3 animate-spin mr-2" />
                      Running
                    </div>
                  ) : (
                    formatDuration(log.start_time, log.end_time)
                  )}
                </TableCell>
                <TableCell>
                  {log.records_processed}
                  {log.total_records && ` / ${log.total_records}`}
                </TableCell>
                <TableCell>{log.api_calls || 0}</TableCell>
                <TableCell>
                  {log.average_response_time ? `${Math.round(log.average_response_time)}ms` : '-'}
                </TableCell>
                <TableCell className="max-w-[300px] truncate">
                  {log.error_message ? (
                    <span className="text-red-500" title={log.error_message}>
                      {log.error_message}
                    </span>
                  ) : (
                    '-'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default DatasetHistory;
