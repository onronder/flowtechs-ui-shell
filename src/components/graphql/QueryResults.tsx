
import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { QueryResult } from "./types";

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
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
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
            {executionTime && (
              <p className="text-sm text-muted-foreground">
                Execution time: {executionTime.toFixed(0)}ms
              </p>
            )}
          </div>
          {queryResult.rateLimitInfo && (
            <Badge className="bg-blue-600">
              API Usage: {queryResult.rateLimitInfo.available}/{queryResult.rateLimitInfo.maximum}
            </Badge>
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
