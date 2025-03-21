
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, convertToDataset, Dataset } from '@/integrations/supabase/client';
import { VirtualizedDataTable, VirtualizedColumn } from '@/components/data-visualization/VirtualizedDataTable';
import { ShopifyDataViewer } from '@/components/data-visualization/ShopifyDataViewer';
import { 
  createDataWorker, 
  processLargeDataset, 
  prepareExport,
  aggregateData,
  detectAnomalies
} from '@/components/data-visualization/utils/backgroundWorker';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, AlertCircle, Database, RefreshCw, MoveDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter 
} from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Data metrics component
const DatasetMetrics = ({ dataset, data }: { dataset: Dataset; data: any[] }) => {
  const [worker, setWorker] = useState<ReturnType<typeof createDataWorker> | null>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [anomalyField, setAnomalyField] = useState<string>('');
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const { toast } = useToast();
  
  // Initialize worker
  useEffect(() => {
    const newWorker = createDataWorker();
    setWorker(newWorker);
    
    return () => {
      newWorker.terminate();
    };
  }, []);
  
  // Generate field options for anomaly detection
  const numericFields = useMemo(() => {
    if (!data.length) return [];
    
    const fields: string[] = [];
    const sample = data[0];
    
    Object.entries(sample).forEach(([key, value]) => {
      if (typeof value === 'number') {
        fields.push(key);
      }
    });
    
    return fields;
  }, [data]);
  
  // Handle anomaly detection
  const handleDetectAnomalies = async () => {
    if (!worker || !anomalyField) return;
    
    try {
      setAnomalyLoading(true);
      const results = await detectAnomalies(worker, data, anomalyField);
      setAnomalies(results);
      
      toast({
        title: 'Anomaly Detection Complete',
        description: `Found ${results.length} anomalies in the ${anomalyField} field`,
      });
    } catch (error) {
      console.error('Anomaly detection error:', error);
      toast({
        variant: 'destructive',
        title: 'Anomaly Detection Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setAnomalyLoading(false);
    }
  };
  
  // Calculate basic stats
  const stats = useMemo(() => {
    if (!data.length) return null;
    
    const recordCount = data.length;
    const createdCount = data.filter(item => 
      item.created_at && new Date(item.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;
    
    const updatedCount = data.filter(item => 
      item.updated_at && item.updated_at !== item.created_at && 
      new Date(item.updated_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;
    
    return {
      totalRecords: recordCount,
      newRecordsLastWeek: createdCount,
      updatedRecordsLastWeek: updatedCount,
    };
  }, [data]);

  // Generate columns for anomaly data table
  const anomalyColumns: VirtualizedColumn<any>[] = useMemo(() => {
    if (!anomalies.length) return [];
    
    return Object.keys(anomalies[0] || {}).map(key => ({
      header: key,
      accessorKey: key,
      sortable: true
    }));
  }, [anomalies]);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dataset Metrics</CardTitle>
        <CardDescription>
          Analytics for "{dataset.name}" dataset
        </CardDescription>
      </CardHeader>
      <CardContent>
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="rounded-lg border p-3">
              <div className="text-sm font-medium text-muted-foreground mb-1">Total Records</div>
              <div className="text-2xl font-bold">{stats.totalRecords.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm font-medium text-muted-foreground mb-1">New Last Week</div>
              <div className="text-2xl font-bold">{stats.newRecordsLastWeek.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm font-medium text-muted-foreground mb-1">Updated Last Week</div>
              <div className="text-2xl font-bold">{stats.updatedRecordsLastWeek.toLocaleString()}</div>
            </div>
          </div>
        )}
        
        <Separator className="my-4" />
        
        {/* Anomaly Detection */}
        <div>
          <h3 className="font-medium mb-2">Anomaly Detection</h3>
          <div className="flex items-center gap-2 mb-4">
            <Select
              value={anomalyField}
              onValueChange={setAnomalyField}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                {numericFields.map(field => (
                  <SelectItem key={field} value={field}>
                    {field}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              onClick={handleDetectAnomalies} 
              disabled={!anomalyField || anomalyLoading}
              size="sm"
            >
              {anomalyLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Detecting...
                </>
              ) : (
                'Detect Anomalies'
              )}
            </Button>
          </div>
          
          {anomalies.length > 0 && (
            <div className="border rounded-md p-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium">Detected Anomalies</h4>
                <Badge variant="outline">{anomalies.length} items</Badge>
              </div>
              <div className="max-h-[300px] overflow-auto">
                <VirtualizedDataTable
                  data={anomalies}
                  columns={anomalyColumns}
                  loadingStatus="success"
                  containerHeight={300}
                  rowHeight={40}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Main component
const EnterpriseVisualization = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [worker, setWorker] = useState<ReturnType<typeof createDataWorker> | null>(null);
  const [processingData, setProcessingData] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'json' | 'chart'>('table');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('csv');
  const [exportingData, setExportingData] = useState(false);
  
  // Initialize worker
  useEffect(() => {
    const newWorker = createDataWorker();
    setWorker(newWorker);
    
    return () => {
      newWorker.terminate();
    };
  }, []);
  
  // Load dataset
  useEffect(() => {
    if (!id) return;
    
    const fetchDataset = async () => {
      try {
        setLoading(true);
        setError(null);
        setProgress(0);
        
        // Fetch dataset metadata
        const { data: datasetData, error: datasetError } = await supabase
          .from('datasets')
          .select('*')
          .eq('id', id)
          .single();
          
        if (datasetError) throw datasetError;
        if (!datasetData) throw new Error('Dataset not found');
        
        const dataset = convertToDataset(datasetData);
        setDataset(dataset);
        
        if (!dataset.data) {
          throw new Error('No data available for this dataset');
        }
        
        setProgress(25);
        
        // Process data in worker if it's large
        if (dataset.data.length > 5000 && worker) {
          setProcessingData(true);
          
          const processedData = await processLargeDataset(
            worker,
            dataset.data,
            [{ type: 'transform', config: { formatters: { id: 'string' } } }],
            1000,
            (progressValue) => {
              setProgress(25 + progressValue * 0.75);
            }
          );
          
          setData(processedData);
          setProcessingData(false);
        } else {
          // For smaller datasets, process directly
          setData(dataset.data);
        }
        
        setProgress(100);
      } catch (error) {
        console.error('Error loading dataset:', error);
        setError(error instanceof Error ? error.message : 'Unknown error loading dataset');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDataset();
  }, [id, worker]);
  
  // Handle export request
  const handleExport = async () => {
    if (!worker || !dataset) return;
    
    try {
      setExportingData(true);
      setExportProgress(0);
      
      const exportContent = await prepareExport(
        worker,
        data,
        exportFormat,
        {
          pretty: true,
          includeHeaders: true
        },
        setExportProgress
      );
      
      // Create and download file
      const blob = new Blob(
        [exportContent], 
        { type: exportFormat === 'json' ? 'application/json' : 'text/csv' }
      );
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${dataset.name}.${exportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Export complete',
        description: `Data exported successfully as ${exportFormat.toUpperCase()}`,
      });
      
      setExportDialogOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setExportingData(false);
    }
  };
  
  // Handle dataset refresh
  const handleRefresh = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const { error: updateError } = await supabase
        .from('datasets')
        .update({ status: 'queued' })
        .eq('id', id);
        
      if (updateError) throw updateError;
      
      toast({
        title: 'Dataset refresh queued',
        description: 'The dataset will be refreshed in the background',
      });
      
      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error refreshing dataset:', error);
      toast({
        variant: 'destructive',
        title: 'Refresh failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      setLoading(false);
    }
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Loading Dataset</h1>
            <p className="text-muted-foreground">
              {processingData ? 'Processing data...' : 'Loading dataset...'}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/datasets')}>
            Back to Datasets
          </Button>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {processingData 
                      ? 'Processing large dataset with background worker'
                      : 'Loading dataset and preparing visualization'
                    }
                  </p>
                  <p className="text-sm text-muted-foreground">
                    This may take a moment for large datasets
                  </p>
                </div>
              </div>
              
              <Progress value={progress} className="h-2" />
              
              <p className="text-sm text-muted-foreground text-center">
                {progress < 100 
                  ? `${Math.round(progress)}% complete`
                  : 'Finalizing visualization...'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Error state
  if (error || !dataset) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Dataset Error</h1>
          <Button variant="outline" onClick={() => navigate('/datasets')}>
            Back to Datasets
          </Button>
        </div>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error || 'Unable to load dataset'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{dataset.name}</h1>
            <Badge variant="outline" className="ml-2">
              {dataset.query_type}
            </Badge>
          </div>
          {dataset.description && (
            <p className="text-muted-foreground mt-1">{dataset.description}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Data
          </Button>
          <Button variant="outline" onClick={() => navigate('/datasets')}>
            Back to Datasets
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Dataset Info</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Records</dt>
                <dd className="text-lg font-semibold">
                  {dataset.record_count?.toLocaleString() || data.length.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Last Updated</dt>
                <dd>
                  {dataset.data_updated_at 
                    ? new Date(dataset.data_updated_at).toLocaleString()
                    : 'Never'
                  }
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Query Type</dt>
                <dd className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  {dataset.query_type}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Query Name</dt>
                <dd>{dataset.query_name}</dd>
              </div>
              {dataset.last_run_duration !== null && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Last Run Duration</dt>
                  <dd>{(dataset.last_run_duration / 1000).toFixed(2)} seconds</dd>
                </div>
              )}
            </dl>
            
            <Separator className="my-4" />
            
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Export Options</h3>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => setExportDialogOpen(true)}
              >
                <MoveDown className="mr-2 h-4 w-4" />
                Export Dataset
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <div className="md:col-span-3 space-y-4">
          <Tabs defaultValue="data" className="w-full">
            <TabsList>
              <TabsTrigger value="data">Data Viewer</TabsTrigger>
              <TabsTrigger value="metrics">Metrics & Analysis</TabsTrigger>
            </TabsList>
            
            <TabsContent value="data" className="mt-4">
              <ShopifyDataViewer
                data={data}
                dataset={dataset}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                enableStreamingExport={true}
                enableScheduledExports={true}
                enableIncrementalExports={dataset.data_updated_at !== null}
                performance={{
                  loading: 'complete',
                  progress: 100,
                  totalRecords: dataset.record_count || data.length,
                  loadedRecords: data.length,
                  executionTime: dataset.last_run_duration || 0,
                }}
              />
            </TabsContent>
            
            <TabsContent value="metrics" className="mt-4">
              <DatasetMetrics dataset={dataset} data={data} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Dataset</DialogTitle>
            <DialogDescription>
              Export "{dataset.name}" to a file.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Export Format</h3>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant={exportFormat === 'csv' ? 'default' : 'outline'}
                  onClick={() => setExportFormat('csv')}
                  className="flex-1"
                >
                  CSV
                </Button>
                <Button
                  type="button"
                  variant={exportFormat === 'json' ? 'default' : 'outline'}
                  onClick={() => setExportFormat('json')}
                  className="flex-1"
                >
                  JSON
                </Button>
              </div>
            </div>
            
            {exportingData && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Preparing export...</span>
                  <span>{Math.round(exportProgress)}%</span>
                </div>
                <Progress value={exportProgress} />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setExportDialogOpen(false)}
              disabled={exportingData}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              onClick={handleExport}
              disabled={exportingData}
            >
              {exportingData ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                'Export'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EnterpriseVisualization;
