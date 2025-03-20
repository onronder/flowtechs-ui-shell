import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase, Dataset } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DatasetPreview } from "./DatasetPreview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DatasetHistory from "./DatasetHistory";
import DatasetSettings from "./DatasetSettings";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Download, Edit, Loader2, PlayCircle, RefreshCw, Trash2 } from "lucide-react";

const DatasetView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  useEffect(() => {
    if (!id) return;
    
    fetchDataset();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'datasets',
          filter: `id=eq.${id}`
        },
        (payload) => {
          setDataset(payload.new as Dataset);
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);
  
  const fetchDataset = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('datasets')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      setDataset(data as Dataset);
    } catch (error) {
      console.error('Error fetching dataset:', error);
      toast({
        variant: "destructive",
        title: "Failed to load dataset",
        description: "There was an error loading the dataset details."
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleRunExtraction = async () => {
    if (!dataset) return;
    
    setRunning(true);
    
    try {
      // Create an extraction log
      const { data: logData, error: logError } = await supabase
        .from('extraction_logs')
        .insert({
          dataset_id: dataset.id,
          status: 'running'
        })
        .select();
        
      if (logError) throw logError;
      
      const extractionLogId = logData?.[0]?.id;
      
      // Update dataset status
      await supabase
        .from('datasets')
        .update({
          status: 'running',
          extraction_progress: 0
        })
        .eq('id', dataset.id);
      
      // Call the edge function to start extraction
      const response = await supabase.functions.invoke('extract-shopify-data', {
        body: {
          sourceId: dataset.source_id,
          datasetId: dataset.id,
          queryType: dataset.query_type,
          queryName: dataset.query_name,
          queryDetails: dataset.query_details,
          extractionLogId
        }
      });
      
      if (response.error) throw new Error(response.error.message);
      
      // Continue extraction if needed
      if (response.data.hasMore) {
        await continueExtraction(
          dataset.id, 
          dataset.source_id, 
          dataset.query_type, 
          dataset.query_name, 
          dataset.query_details, 
          extractionLogId, 
          response.data.nextCursor
        );
      } else {
        // If single-page result, update dataset as completed
        await supabase
          .from('datasets')
          .update({
            status: 'completed',
            extraction_progress: 100,
            data_updated_at: new Date().toISOString()
          })
          .eq('id', dataset.id);
          
        // Update extraction log
        await supabase
          .from('extraction_logs')
          .update({
            status: 'completed',
            end_time: new Date().toISOString()
          })
          .eq('id', extractionLogId);
      }
      
      toast({
        title: "Extraction started",
        description: "Your data extraction has been started successfully."
      });
    } catch (error) {
      console.error('Error running extraction:', error);
      toast({
        variant: "destructive",
        title: "Failed to start extraction",
        description: error instanceof Error ? error.message : "An unknown error occurred."
      });
      
      // Update dataset with error
      await supabase
        .from('datasets')
        .update({
          status: 'failed',
          last_error_details: {
            message: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date().toISOString()
          }
        })
        .eq('id', dataset.id);
    } finally {
      setRunning(false);
    }
  };
  
  const continueExtraction = async (
    datasetId: string,
    sourceId: string,
    queryType: string,
    queryName: string,
    queryDetails: any,
    extractionLogId: string,
    cursor: string
  ) => {
    try {
      // Call the edge function to continue extraction
      const response = await supabase.functions.invoke('extract-shopify-data', {
        body: {
          sourceId,
          datasetId,
          queryType,
          queryName,
          queryDetails,
          extractionLogId,
          cursor
        }
      });
      
      if (response.error) throw new Error(response.error.message);
      
      // Calculate progress (rough estimate)
      const progress = Math.min(
        Math.floor((cursor.length / (cursor.length + response.data.nextCursor?.length || 1)) * 100),
        95 // Cap at 95% until fully complete
      );
      
      // Update progress
      await supabase
        .from('datasets')
        .update({
          extraction_progress: progress
        })
        .eq('id', datasetId);
      
      // Continue extraction if needed
      if (response.data.hasMore) {
        await continueExtraction(
          datasetId,
          sourceId,
          queryType,
          queryName,
          queryDetails,
          extractionLogId,
          response.data.nextCursor
        );
      } else {
        // If all pages processed, update dataset as completed
        await supabase
          .from('datasets')
          .update({
            status: 'completed',
            extraction_progress: 100,
            data_updated_at: new Date().toISOString()
          })
          .eq('id', datasetId);
          
        // Update extraction log
        await supabase
          .from('extraction_logs')
          .update({
            status: 'completed',
            end_time: new Date().toISOString()
          })
          .eq('id', extractionLogId);
          
        toast({
          title: "Extraction completed",
          description: "Your data extraction has been completed successfully."
        });
      }
    } catch (error) {
      console.error('Error continuing extraction:', error);
      
      // Update dataset with error
      await supabase
        .from('datasets')
        .update({
          status: 'failed',
          last_error_details: {
            message: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date().toISOString()
          }
        })
        .eq('id', datasetId);
        
      // Update extraction log
      await supabase
        .from('extraction_logs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : "Unknown error",
          end_time: new Date().toISOString()
        })
        .eq('id', extractionLogId);
    }
  };
  
  const handlePreviewData = async () => {
    if (!dataset) return;
    
    setPreviewLoading(true);
    
    try {
      // Create a temporary extraction log for preview
      const { data: logData, error: logError } = await supabase
        .from('extraction_logs')
        .insert({
          dataset_id: dataset.id,
          status: 'running'
        })
        .select();
        
      if (logError) throw logError;
      
      const extractionLogId = logData?.[0]?.id;
      
      // Call the edge function to fetch preview
      const response = await supabase.functions.invoke('extract-shopify-data', {
        body: {
          sourceId: dataset.source_id,
          datasetId: dataset.id,
          queryType: dataset.query_type,
          queryName: dataset.query_name,
          queryDetails: dataset.query_details,
          extractionLogId,
          sampleOnly: true
        }
      });
      
      if (response.error) throw new Error(response.error.message);
      
      setPreviewData(response.data);
    } catch (error) {
      console.error('Error fetching preview:', error);
      toast({
        variant: "destructive",
        title: "Failed to load preview",
        description: error instanceof Error ? error.message : "An unknown error occurred."
      });
    } finally {
      setPreviewLoading(false);
    }
  };
  
  const handleDeleteDataset = async () => {
    if (!dataset) return;
    
    if (!confirm("Are you sure you want to delete this dataset? This action cannot be undone.")) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('datasets')
        .delete()
        .eq('id', dataset.id);
        
      if (error) throw error;
      
      toast({
        title: "Dataset deleted",
        description: "The dataset has been permanently deleted."
      });
      
      navigate('/datasets');
    } catch (error) {
      console.error('Error deleting dataset:', error);
      toast({
        variant: "destructive",
        title: "Failed to delete dataset",
        description: "There was an error deleting the dataset."
      });
    }
  };
  
  const handleExportData = async () => {
    if (!dataset || !dataset.data) return;
    
    try {
      // Prepare file for download
      const dataStr = JSON.stringify(dataset.data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create download link and trigger it
      const link = document.createElement('a');
      link.href = url;
      link.download = `${dataset.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Export started",
        description: "Your dataset is being downloaded."
      });
    } catch (error) {
      console.error('Error exporting dataset:', error);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "There was an error exporting the dataset."
      });
    }
  };
  
  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'running':
        return <Badge className="bg-blue-500">Running</Badge>;
      case 'failed':
        return <Badge className="bg-red-500">Failed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case 'ready':
        return <Badge className="bg-green-700">Ready</Badge>;
      default:
        return <Badge className="bg-gray-500">{status || 'Unknown'}</Badge>;
    }
  };
  
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center">
          <Skeleton className="h-8 w-8 mr-2" />
          <Skeleton className="h-8 w-60" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-60" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!dataset) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dataset not found</CardTitle>
          <CardDescription>
            The dataset you're looking for could not be found.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            The dataset may have been deleted or you don't have access to it.
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={() => navigate('/datasets')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Datasets
          </Button>
        </CardFooter>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            className="mr-2"
            onClick={() => navigate("/datasets")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{dataset.name}</h2>
            {dataset.description && (
              <p className="text-muted-foreground">{dataset.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/datasets/edit/${dataset.id}`)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button 
            variant="default" 
            onClick={handleRunExtraction} 
            disabled={running || dataset.status === 'running'}
          >
            {running || dataset.status === 'running' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="mr-2 h-4 w-4" />
            )}
            Run Extraction
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Dataset Details</CardTitle>
              <CardDescription>Details and status of your dataset</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePreviewData} disabled={previewLoading}>
                {previewLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Preview Data
              </Button>
              {dataset.data && (
                <Button variant="outline" size="sm" onClick={handleExportData}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Data
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={handleDeleteDataset}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Dataset
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm font-medium">Status</p>
              <div className="flex items-center">
                {getStatusBadge(dataset.status)}
                {dataset.status === 'running' && (
                  <div className="w-full max-w-[120px]">
                    <Progress 
                      value={dataset.extraction_progress || 0} 
                      className="h-2"
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      {dataset.extraction_progress || 0}% complete
                    </div>
                  </div>
                )}
              </div>
              {dataset.status === 'failed' && dataset.last_error_details && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTitle>Extraction Failed</AlertTitle>
                  <AlertDescription>
                    {typeof dataset.last_error_details === 'object' && dataset.last_error_details.message ? 
                      dataset.last_error_details.message : 
                      'An error occurred during extraction.'}
                  </AlertDescription>
                </Alert>
              )}
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium">Data Type</p>
              <div>
                <Badge variant="outline" className="capitalize">
                  {dataset.query_type}
                </Badge>
                <span className="text-sm ml-2">
                  {dataset.query_name}
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium">Records</p>
              <p>{dataset.record_count || 0} records</p>
              {dataset.data_updated_at && (
                <p className="text-xs text-muted-foreground">
                  Last updated {formatDistanceToNow(new Date(dataset.data_updated_at))} ago
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Tabs defaultValue="preview">
        <TabsList>
          <TabsTrigger value="preview">Data Preview</TabsTrigger>
          <TabsTrigger value="history">Extraction History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="preview" className="mt-4">
          {previewData ? (
            <DatasetPreview 
              data={previewData} 
              loading={previewLoading}
              queryType={dataset.query_type}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Data Preview</CardTitle>
                <CardDescription>
                  Click the "Preview Data" button to see a sample of your data.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handlePreviewData} disabled={previewLoading}>
                  {previewLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Load Preview
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="history" className="mt-4">
          <DatasetHistory datasetId={dataset.id} />
        </TabsContent>
        
        <TabsContent value="settings" className="mt-4">
          <DatasetSettings dataset={dataset} onUpdate={fetchDataset} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DatasetView;
