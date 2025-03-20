import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { supabase, Dataset } from "@/integrations/supabase/client";
import { 
  CheckCircle, 
  Clock, 
  Copy, 
  Download, 
  Eye, 
  MoreHorizontal, 
  PlayCircle, 
  Plus, 
  RefreshCw, 
  Trash2, 
  XCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

const DatasetList = () => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDatasets();

    // Set up realtime subscription for datasets
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'datasets'
        },
        () => {
          // Refetch datasets when changes occur
          fetchDatasets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDatasets = async () => {
    try {
      const { data, error } = await supabase
        .from('datasets')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      
      setDatasets(data as Dataset[]);
    } catch (error) {
      console.error('Error fetching datasets:', error);
      toast({
        variant: "destructive",
        title: "Failed to load datasets",
        description: "There was an error loading your datasets. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDataset = () => {
    navigate('/datasets/new');
  };

  const handleViewDataset = (id: string) => {
    navigate(`/datasets/${id}`);
  };

  const handleDuplicateDataset = async (dataset: Dataset) => {
    try {
      // Create a new dataset based on the existing one
      const { data, error } = await supabase
        .from('datasets')
        .insert({
          name: `${dataset.name} (Copy)`,
          description: dataset.description,
          source_id: dataset.source_id,
          query_type: dataset.query_type,
          query_name: dataset.query_name,
          query_details: dataset.query_details,
          user_id: dataset.user_id,
          status: 'pending'
        })
        .select();
      
      if (error) throw error;
      
      toast({
        title: "Dataset duplicated",
        description: "A copy of the dataset has been created."
      });
      
      // Refresh list
      fetchDatasets();
    } catch (error) {
      console.error('Error duplicating dataset:', error);
      toast({
        variant: "destructive",
        title: "Failed to duplicate dataset",
        description: "There was an error creating a copy of the dataset."
      });
    }
  };

  const handleDeleteDataset = async (id: string) => {
    try {
      const { error } = await supabase
        .from('datasets')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Dataset deleted",
        description: "The dataset has been permanently deleted."
      });
      
      // Refresh list
      fetchDatasets();
    } catch (error) {
      console.error('Error deleting dataset:', error);
      toast({
        variant: "destructive",
        title: "Failed to delete dataset",
        description: "There was an error deleting the dataset."
      });
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="mr-1 h-3 w-3" /> Completed</Badge>;
      case 'running':
        return <Badge className="bg-blue-500"><PlayCircle className="mr-1 h-3 w-3" /> Running</Badge>;
      case 'failed':
        return <Badge className="bg-red-500"><XCircle className="mr-1 h-3 w-3" /> Failed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500"><Clock className="mr-1 h-3 w-3" /> Pending</Badge>;
      case 'ready':
        return <Badge className="bg-green-700"><CheckCircle className="mr-1 h-3 w-3" /> Ready</Badge>;
      default:
        return <Badge className="bg-gray-500">{status || 'Unknown'}</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return format(new Date(dateString), "MMM d, yyyy HH:mm");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-60" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Your Datasets</h2>
        <Button onClick={handleCreateDataset}>
          <Plus className="mr-2 h-4 w-4" /> New Dataset
        </Button>
      </div>

      {datasets.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No datasets found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You haven't created any datasets yet. Click "New Dataset" to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datasets.map((dataset) => (
                  <TableRow key={dataset.id}>
                    <TableCell className="font-medium">
                      <div className="max-w-[200px] truncate" title={dataset.name}>
                        {dataset.name}
                      </div>
                      {dataset.description && (
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]" 
                             title={dataset.description}>
                          {dataset.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {dataset.query_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(dataset.status)}</TableCell>
                    <TableCell>{dataset.record_count || '-'}</TableCell>
                    <TableCell>{formatDate(dataset.data_updated_at)}</TableCell>
                    <TableCell>
                      {dataset.status === 'running' ? (
                        <div className="w-full max-w-[120px]">
                          <Progress 
                            value={dataset.extraction_progress || 0} 
                            className="h-2"
                          />
                          <div className="text-xs text-muted-foreground mt-1">
                            {dataset.extraction_progress || 0}% complete
                          </div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDataset(dataset.id)}>
                            <Eye className="mr-2 h-4 w-4" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {}}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Run Extraction
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicateDataset(dataset)}>
                            <Copy className="mr-2 h-4 w-4" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {}}>
                            <Download className="mr-2 h-4 w-4" /> Export
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteDataset(dataset.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

export default DatasetList;
