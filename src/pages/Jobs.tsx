
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { supabase, Dataset } from "@/integrations/supabase/client";
import { AlertCircle, CalendarClock, CheckCircle, PlayCircle, XCircle } from "lucide-react";

const Jobs = () => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchDatasets() {
      try {
        const { data, error } = await supabase
          .from('datasets')
          .select('*')
          .order('next_scheduled_run', { ascending: true });
        
        if (error) throw error;
        
        // Properly handle the optional performance_metrics field
        setDatasets((data || []).map(item => ({
          ...item,
          performance_metrics: item.performance_metrics || null
        } as Dataset)));
      } catch (error) {
        console.error('Error fetching datasets:', error);
        toast({
          variant: "destructive",
          title: "Failed to load jobs",
          description: "There was an error loading your data processing jobs.",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchDatasets();
  }, [toast]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="mr-1 h-3 w-3" /> Completed</Badge>;
      case 'running':
        return <Badge className="bg-blue-500"><PlayCircle className="mr-1 h-3 w-3" /> Running</Badge>;
      case 'failed':
        return <Badge className="bg-red-500"><XCircle className="mr-1 h-3 w-3" /> Failed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500"><CalendarClock className="mr-1 h-3 w-3" /> Pending</Badge>;
      default:
        return <Badge className="bg-gray-500"><AlertCircle className="mr-1 h-3 w-3" /> {status}</Badge>;
    }
  };

  const formatDuration = (durationMs: number | null) => {
    if (!durationMs) return "-";
    
    const seconds = Math.floor(durationMs / 1000);
    if (seconds < 60) return `${seconds}s`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return format(new Date(dateString), "MMM d, yyyy HH:mm");
  };

  const handleRunNow = async (datasetId: string) => {
    // In a real implementation, this would trigger a backend job
    toast({
      title: "Job triggered",
      description: "Your data processing job has been queued to run.",
    });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground">
            Manage your data processing jobs and schedules.
          </p>
        </div>
        <Button>
          Create Job
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ) : datasets.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Jobs Found</CardTitle>
            <CardDescription>
              You don't have any data processing jobs configured yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create a new job to start processing data from your sources.
            </p>
          </CardContent>
          <CardFooter>
            <Button>Create Your First Job</Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Scheduled Jobs</CardTitle>
            <CardDescription>
              All your configured data processing jobs and their current status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datasets.map((dataset) => (
                  <TableRow key={dataset.id}>
                    <TableCell className="font-medium">{dataset.name}</TableCell>
                    <TableCell>{dataset.source_id}</TableCell>
                    <TableCell>{getStatusBadge(dataset.status)}</TableCell>
                    <TableCell>{formatDate(dataset.last_completed_run)}</TableCell>
                    <TableCell>{formatDuration(dataset.last_run_duration)}</TableCell>
                    <TableCell>{dataset.record_count || "-"}</TableCell>
                    <TableCell>{formatDate(dataset.next_scheduled_run)}</TableCell>
                    <TableCell>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleRunNow(dataset.id)}
                      >
                        Run Now
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Jobs;
