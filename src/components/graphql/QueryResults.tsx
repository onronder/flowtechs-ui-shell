
import { AlertCircle, RefreshCw, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryResult } from "./types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QueryResultsProps {
  isExecuting: boolean;
  errorMessage: string | null;
  queryResult: QueryResult | null;
  executionTime: number | null;
}

const QueryResults = ({ isExecuting, errorMessage, queryResult, executionTime }: QueryResultsProps) => {
  if (isExecuting) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="mb-2">
            <RefreshCw className="h-10 w-10 animate-spin mx-auto text-primary" />
          </div>
          <p>Executing query...</p>
        </div>
      </div>
    );
  }
  
  if (errorMessage) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {errorMessage}
        </AlertDescription>
      </Alert>
    );
  }
  
  if (queryResult) {
    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-medium">Query Results</h3>
            <div className="flex items-center text-sm text-muted-foreground space-x-2">
              {executionTime && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {executionTime.toFixed(0)}ms
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Total execution time including network</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              {queryResult.fromCache && (
                <Badge variant="outline" className="text-amber-500 border-amber-500">
                  From Cache
                </Badge>
              )}
              
              {queryResult.requestId && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-gray-500">
                        #{queryResult.requestId.substring(0, 8)}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Request ID: {queryResult.requestId}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
          
          {queryResult.rateLimitInfo && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className={`bg-blue-600 ${queryResult.rateLimitInfo.available < queryResult.rateLimitInfo.maximum * 0.2 ? 'bg-red-600' : ''}`}>
                    API: {queryResult.rateLimitInfo.available}/{queryResult.rateLimitInfo.maximum}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1">
                    <p>Available API calls: {queryResult.rateLimitInfo.available}</p>
                    <p>Maximum API calls: {queryResult.rateLimitInfo.maximum}</p>
                    <p>Restore rate: {queryResult.rateLimitInfo.restoreRate}/sec</p>
                    <p>This request cost: {queryResult.rateLimitInfo.requestCost}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-22rem)]">
              <pre className="font-mono text-sm p-4 overflow-x-auto whitespace-pre">
                {JSON.stringify(queryResult.data, null, 2)}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="text-center py-12">
      <p className="text-muted-foreground">
        Execute a query to see results here.
      </p>
    </div>
  );
};

export default QueryResults;
