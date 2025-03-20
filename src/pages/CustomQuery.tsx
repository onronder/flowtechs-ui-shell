
import { useState, useEffect } from "react";
import { supabase, Source } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import QueryBuilder from "@/components/graphql/QueryBuilder";

const CustomQuery = () => {
  const { toast } = useToast();
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSources = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("sources")
          .select("*")
          .eq("type", "shopify")
          .eq("connection_status", "connected");
          
        if (error) throw error;
        
        setSources(data as Source[]);
        
        // Auto-select the first source if available
        if (data && data.length > 0) {
          setSelectedSource(data[0].id);
        }
      } catch (error) {
        console.error("Error fetching sources:", error);
        toast({
          variant: "destructive",
          title: "Failed to load sources",
          description: "There was an error loading your connected Shopify stores."
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchSources();
  }, [toast]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Custom Query Builder</h1>
        <p className="text-muted-foreground">
          Build custom GraphQL queries for Shopify data extraction
        </p>
      </div>
      
      <div className="space-y-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl">Select Shopify Store</CardTitle>
            <CardDescription>
              Choose a connected Shopify store to query its data
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sources.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No connected Shopify stores found. Please connect a store first.
                </AlertDescription>
              </Alert>
            ) : (
              <Select
                value={selectedSource}
                onValueChange={setSelectedSource}
              >
                <SelectTrigger className="w-full md:w-[300px]">
                  <SelectValue placeholder="Select a store" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((source) => (
                    <SelectItem key={source.id} value={source.id}>
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
        
        {selectedSource && (
          <div className="h-[calc(100vh-20rem)]">
            <QueryBuilder sourceId={selectedSource} />
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomQuery;
