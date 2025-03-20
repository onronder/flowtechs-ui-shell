
import { useState, useEffect } from "react";
import { Dataset, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, PauseCircle, PlayCircle, StopCircle } from "lucide-react";
import { QueryProgress } from "@/utils/shopifyDependentQuery";

interface DependentQueryComponentProps {
  dataset: Dataset;
  onComplete: () => void;
}

const DependentQueryComponent = ({ dataset, onComplete }: DependentQueryComponentProps) => {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState<QueryProgress | null>(null);
  const [phase, setPhase] = useState<string>("preparing");
  const [activeTab, setActiveTab] = useState<string>("progress");
  
  // Function to start the dependent query extraction
  const startDependentExtraction = async () => {
    if (!dataset) return;
    
    setRunning(true);
    setPaused(false);
    setPhase("preparing");
    
    try {
      // Create an extraction log
      const { data: logData, error: logError } = await supabase
        .from('extraction_logs')
        .insert({
          dataset_id: dataset.id,
          status: 'running',
          metadata: {
            extraction_type: 'dependent_query',
            query_type: dataset.query_type,
            query_name: dataset.query_name
          }
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
      
      // Call the edge function to start the dependent extraction
      const response = await supabase.functions.invoke('extract-dependent-data', {
        body: {
          sourceId: dataset.source_id,
          datasetId: dataset.id,
          queryType: dataset.query_type,
          queryName: dataset.query_name,
          queryDetails: dataset.query_details,
          extractionLogId,
          extractionSettings: dataset.extraction_settings
        }
      });
      
      if (response.error) throw new Error(response.error.message);
      
      // Handle the response
      if (response.data.success) {
        toast({
          title: "Extraction completed",
          description: "Dependent data extraction completed successfully."
        });
        
        // Update dataset status
        await supabase
          .from('datasets')
          .update({
            status: 'completed',
            extraction_progress: 100,
            data_updated_at: new Date().toISOString(),
            record_count: response.data.recordCount || 0,
            performance_metrics: response.data.performance
          })
          .eq('id', dataset.id);
          
        // Update extraction log
        await supabase
          .from('extraction_logs')
          .update({
            status: 'completed',
            end_time: new Date().toISOString(),
            records_processed: response.data.recordCount || 0,
            total_records: response.data.recordCount || 0,
            api_calls: response.data.performance?.apiCalls || 0,
            average_response_time: response.data.performance?.averageResponseTime || 0
          })
          .eq('id', extractionLogId);
          
        // Notify completion
        onComplete();
      } else {
        throw new Error(response.data.error || "Unknown error during extraction");
      }
    } catch (error) {
      console.error('Error running dependent extraction:', error);
      toast({
        variant: "destructive",
        title: "Extraction failed",
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
      setPaused(false);
    }
  };
  
  // Handle progress updates
  useEffect(() => {
    if (!running) return;
    
    const channel = supabase
      .channel('extraction-progress')
      .on(
        'broadcast',
        { event: `extraction:${dataset.id}:progress` },
        (payload) => {
          const progressData = payload.payload as QueryProgress;
          setProgress(progressData);
          setPhase(progressData.currentPhase);
          
          // Update extraction progress in the dataset
          const progressPercent = Math.floor(
            (progressData.processedItems / Math.max(progressData.totalItems, 1)) * 100
          );
          
          supabase
            .from('datasets')
            .update({
              extraction_progress: progressPercent
            })
            .eq('id', dataset.id)
            .then(() => {});
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [running, dataset.id]);
  
  // Function to pause/resume extraction
  const togglePause = async () => {
    setPaused(!paused);
    
    // Broadcast pause/resume event
    await supabase.channel('extraction-control').send({
      type: 'broadcast',
      event: `extraction:${dataset.id}:${paused ? 'resume' : 'pause'}`,
      payload: {}
    });
    
    toast({
      title: paused ? "Extraction resumed" : "Extraction paused",
      description: paused ? "Extraction has been resumed" : "Extraction has been paused and will continue when resumed"
    });
  };
  
  // Function to cancel extraction
  const cancelExtraction = async () => {
    if (!confirm("Are you sure you want to cancel this extraction? This will stop the process immediately.")) {
      return;
    }
    
    try {
      // Broadcast cancel event
      await supabase.channel('extraction-control').send({
        type: 'broadcast',
        event: `extraction:${dataset.id}:cancel`,
        payload: {}
      });
      
      // Update dataset status
      await supabase
        .from('datasets')
        .update({
          status: 'cancelled',
          last_error_details: {
            message: "Extraction cancelled by user",
            timestamp: new Date().toISOString()
          }
        })
        .eq('id', dataset.id);
        
      toast({
        title: "Extraction cancelled",
        description: "The extraction process has been cancelled."
      });
      
      setRunning(false);
      setPaused(false);
    } catch (error) {
      console.error('Error cancelling extraction:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to cancel extraction."
      });
    }
  };
  
  // Format time in a readable way
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const remainingMinutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${remainingMinutes}m`;
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dependent Query Extraction</CardTitle>
        <CardDescription>
          Extract and process related Shopify data with optimized queries
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {running ? (
          <div>
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center">
                  <Badge variant="outline" className="mr-2">
                    {phase}
                  </Badge>
                  {paused && <Badge className="bg-yellow-500">Paused</Badge>}
                </div>
                <div className="text-sm font-medium">
                  {progress ? `${progress.processedItems} / ${progress.totalItems} items` : 'Initializing...'}
                </div>
              </div>
              <Progress 
                value={progress ? (progress.processedItems / Math.max(progress.totalItems, 1)) * 100 : 0} 
                className="h-2"
              />
              {progress?.estimatedTimeRemaining !== null && (
                <div className="text-xs text-muted-foreground mt-1">
                  Estimated time remaining: {formatTime(progress?.estimatedTimeRemaining || 0)}
                </div>
              )}
            </div>
            
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="progress" className="flex-1">Progress</TabsTrigger>
                <TabsTrigger value="errors" className="flex-1">Errors ({progress?.errors.length || 0})</TabsTrigger>
                <TabsTrigger value="metrics" className="flex-1">Metrics</TabsTrigger>
              </TabsList>
              
              <TabsContent value="progress" className="mt-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border rounded-md p-3">
                      <div className="text-sm text-muted-foreground">Processed</div>
                      <div className="text-2xl font-bold">{progress?.processedItems || 0}</div>
                    </div>
                    <div className="border rounded-md p-3">
                      <div className="text-sm text-muted-foreground">Batches</div>
                      <div className="text-2xl font-bold">{progress?.completedBatches || 0} / {progress?.totalBatches || 0}</div>
                    </div>
                  </div>
                  
                  <div className="border rounded-md p-3">
                    <div className="text-sm font-medium mb-2">Current Phase</div>
                    <div className="text-base">{phase}</div>
                    {progress?.currentPhase && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {progress.currentPhase}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="errors" className="mt-4">
                {(!progress || progress.errors.length === 0) ? (
                  <div className="text-center p-4 text-muted-foreground">
                    No errors reported
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {progress.errors.map((error, index) => (
                      <Alert key={index} variant="destructive">
                        <AlertTitle>{error.phase}</AlertTitle>
                        <AlertDescription className="text-xs">
                          {error.message}
                          {error.itemId && <div>Item ID: {error.itemId}</div>}
                          <div className="text-xs mt-1 opacity-70">
                            {new Date(error.timestamp).toLocaleTimeString()}
                          </div>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="metrics" className="mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded-md p-3">
                    <div className="text-sm text-muted-foreground">Records/Second</div>
                    <div className="text-2xl font-bold">
                      {progress?.performanceMetrics.recordsPerSecond.toFixed(2) || '0.00'}
                    </div>
                  </div>
                  <div className="border rounded-md p-3">
                    <div className="text-sm text-muted-foreground">API Calls/Record</div>
                    <div className="text-2xl font-bold">
                      {progress?.performanceMetrics.apiCallsPerRecord.toFixed(2) || '0.00'}
                    </div>
                  </div>
                  <div className="border rounded-md p-3">
                    <div className="text-sm text-muted-foreground">Avg Response Time</div>
                    <div className="text-2xl font-bold">
                      {progress?.performanceMetrics.averageResponseTime.toFixed(0) || '0'} ms
                    </div>
                  </div>
                  <div className="border rounded-md p-3">
                    <div className="text-sm text-muted-foreground">Rate Limit Usage</div>
                    <div className="text-2xl font-bold">
                      {progress?.rateLimitInfo ? 
                        `${((progress.rateLimitInfo.maximum - progress.rateLimitInfo.available) / progress.rateLimitInfo.maximum * 100).toFixed(0)}%` : 
                        '0%'}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-6">
              Dependent query extraction allows you to extract complex data relationships
              while optimizing API usage and handling rate limits intelligently.
            </p>
            <Button onClick={startDependentExtraction}>
              <PlayCircle className="mr-2 h-4 w-4" />
              Start Dependent Query Extraction
            </Button>
          </div>
        )}
      </CardContent>
      {running && (
        <CardFooter className="justify-end space-x-2">
          <Button 
            variant="outline" 
            onClick={togglePause} 
            disabled={!running}
          >
            {paused ? (
              <><PlayCircle className="mr-2 h-4 w-4" /> Resume</>
            ) : (
              <><PauseCircle className="mr-2 h-4 w-4" /> Pause</>
            )}
          </Button>
          <Button 
            variant="destructive" 
            onClick={cancelExtraction} 
            disabled={!running}
          >
            <StopCircle className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default DependentQueryComponent;
