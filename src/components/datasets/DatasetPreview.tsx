
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";

interface DatasetPreviewProps {
  data: any;
  loading: boolean;
  queryType: string;
}

export const DatasetPreview = ({ data, loading, queryType }: DatasetPreviewProps) => {
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>("table");
  const [fields, setFields] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && data) {
      if (data.success === false) {
        setError(data.error || "Unknown error occurred");
        return;
      }
      
      // Reset error state if successful
      setError(null);
      
      const samples = data.sample || [];
      setSampleData(samples);
      
      // Extract fields from the first item (if available)
      if (samples.length > 0) {
        const allFields = new Set<string>();
        
        // Recursively extract all top-level fields
        const extractFields = (obj: any, parentKey: string = "") => {
          if (!obj || typeof obj !== "object") return;
          
          Object.keys(obj).forEach(key => {
            const fullKey = parentKey ? `${parentKey}.${key}` : key;
            
            // Add only top-level or first-level nested fields to avoid overwhelming the user
            if (!parentKey || parentKey.split(".").length <= 1) {
              allFields.add(fullKey);
            }
            
            // Continue recursion but limit depth to avoid excessive nesting
            if (typeof obj[key] === "object" && obj[key] !== null && parentKey.split(".").length < 1) {
              extractFields(obj[key], fullKey);
            }
          });
        };
        
        extractFields(samples[0]);
        setFields(Array.from(allFields).sort());
      }
    }
  }, [data, loading]);

  const renderValue = (value: any): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground italic">null</span>;
    }
    
    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }
    
    if (typeof value === "number") {
      return value;
    }
    
    if (typeof value === "string") {
      if (value.match(/^https?:\/\//i)) {
        return (
          <a 
            href={value} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-500 hover:underline truncate max-w-[300px] inline-block"
          >
            {value}
          </a>
        );
      }
      return value;
    }
    
    if (Array.isArray(value)) {
      return `Array (${value.length} items)`;
    }
    
    if (typeof value === "object") {
      return <span className="text-green-600 font-mono text-xs">Object {`{...}`}</span>;
    }
    
    return String(value);
  };

  const getNestedValue = (obj: any, path: string) => {
    const parts = path.split(".");
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== "object") {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Preview</CardTitle>
          <CardDescription>Loading sample data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Preview</CardTitle>
          <CardDescription>There was an error fetching the preview</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.sample || data.sample.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Preview</CardTitle>
          <CardDescription>No sample data available</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>No Data</AlertTitle>
            <AlertDescription>
              No data could be retrieved from the source. Please check your query configuration or ensure the source contains data.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Data Preview</CardTitle>
            <CardDescription>
              Sample of data from your Shopify store
            </CardDescription>
          </div>
          {data.rateLimitInfo && (
            <div className="text-right">
              <div className="text-sm text-muted-foreground">
                API Usage: 
                <Badge className="ml-2 bg-blue-600">
                  {data.rateLimitInfo.available}/{data.rateLimitInfo.total}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Response Time: {data.responseTime}ms
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="table">Table View</TabsTrigger>
            <TabsTrigger value="json">JSON View</TabsTrigger>
            <TabsTrigger value="fields">Fields</TabsTrigger>
          </TabsList>
          
          <TabsContent value="table" className="mt-4">
            <ScrollArea className="h-[450px] rounded-md border">
              <div className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {fields.slice(0, 10).map((field) => (
                        <TableHead key={field}>{field}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sampleData.map((item, index) => (
                      <TableRow key={index}>
                        {fields.slice(0, 10).map((field) => (
                          <TableCell key={field} className="truncate max-w-[200px]">
                            {renderValue(getNestedValue(item, field))}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {fields.length > 10 && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    * Showing only first 10 columns for readability
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="json" className="mt-4">
            <ScrollArea className="h-[450px] rounded-md border">
              <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                {JSON.stringify(sampleData, null, 2)}
              </pre>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="fields" className="mt-4">
            <ScrollArea className="h-[450px] rounded-md border">
              <div className="p-4">
                <div className="mb-4">
                  <h3 className="text-sm font-medium mb-2">Available Fields</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    This dataset contains the following fields:
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {fields.map((field) => {
                    const sample = sampleData[0];
                    const value = getNestedValue(sample, field);
                    let type = "unknown";
                    
                    if (value === null) type = "null";
                    else if (typeof value === "boolean") type = "boolean";
                    else if (typeof value === "number") type = "number";
                    else if (typeof value === "string") type = "string";
                    else if (Array.isArray(value)) type = "array";
                    else if (typeof value === "object") type = "object";
                    
                    let exampleValue = value;
                    if (typeof value === "object" && value !== null) {
                      exampleValue = "Object";
                    } else if (Array.isArray(value)) {
                      exampleValue = `Array[${value.length}]`;
                    } else if (typeof value === "string" && value.length > 30) {
                      exampleValue = value.substring(0, 30) + "...";
                    }
                    
                    return (
                      <div key={field} className="p-2 border rounded">
                        <div className="font-medium text-sm">{field}</div>
                        <div className="text-xs flex justify-between mt-1">
                          <Badge variant="outline" className="text-xs">
                            {type}
                          </Badge>
                          <span className="text-muted-foreground truncate ml-2 max-w-[150px]">
                            {exampleValue === undefined ? "undefined" : String(exampleValue)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
        
        <div className="mt-4 text-sm text-muted-foreground flex items-center">
          <InfoIcon className="h-4 w-4 mr-2" />
          <span>
            Showing {sampleData.length} sample records. 
            {data.hasMore && " There are more records available in the full extraction."}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
