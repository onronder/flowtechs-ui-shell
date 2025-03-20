
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DatasetTemplate, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface DatasetTemplateListProps {
  templates: DatasetTemplate[];
  loading: boolean;
  onRefresh: () => void;
}

const DatasetTemplateList = ({ templates, loading, onRefresh }: DatasetTemplateListProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  
  // Function to create a dataset from a template
  const createFromTemplate = async (template: DatasetTemplate) => {
    try {
      setCreating(true);
      
      // Get sources for selection
      const { data: sources, error: sourcesError } = await supabase
        .from('sources')
        .select('id, name, type')
        .eq('type', 'shopify')
        .eq('connection_status', 'connected');
      
      if (sourcesError) throw sourcesError;
      
      if (!sources || sources.length === 0) {
        toast({
          variant: "destructive",
          title: "No connected sources",
          description: "You need to connect a Shopify source before creating a dataset."
        });
        return;
      }
      
      // For now, use the first available source
      const sourceId = sources[0].id;
      
      // Create a new dataset based on the template
      const { data, error } = await supabase
        .from('datasets')
        .insert({
          name: `${template.name} (from template)`,
          description: template.description,
          query_type: template.query_type,
          query_name: template.query_name,
          query_details: template.query_details,
          source_id: sourceId,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          is_template: false,
          template_id: template.id,
          extraction_settings: {
            batch_size: 25,
            max_retries: 3,
            throttle_delay_ms: 500,
            circuit_breaker_threshold: 5,
            timeout_seconds: 30,
            concurrent_requests: 4,
            deduplication_enabled: true,
            cache_enabled: true,
            field_optimization: true
          }
        })
        .select('id')
        .single();
      
      if (error) throw error;
      
      toast({
        title: "Dataset created",
        description: "New dataset has been created from template."
      });
      
      // Navigate to the newly created dataset
      navigate(`/datasets/${data.id}`);
    } catch (error) {
      console.error('Error creating dataset from template:', error);
      toast({
        variant: "destructive",
        title: "Failed to create dataset",
        description: "There was an error creating a dataset from this template."
      });
    } finally {
      setCreating(false);
    }
  };
  
  // Function to get badge color based on query type
  const getQueryTypeBadge = (queryType: string) => {
    switch (queryType) {
      case 'product':
        return <Badge className="bg-blue-500">Product</Badge>;
      case 'order':
        return <Badge className="bg-green-500">Order</Badge>;
      case 'customer':
        return <Badge className="bg-purple-500">Customer</Badge>;
      case 'inventory':
        return <Badge className="bg-amber-500">Inventory</Badge>;
      case 'collection':
        return <Badge className="bg-teal-500">Collection</Badge>;
      default:
        return <Badge>{queryType}</Badge>;
    }
  };
  
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (templates.length === 0) {
    return (
      <Alert>
        <AlertTitle>No templates available</AlertTitle>
        <AlertDescription>
          Dataset templates will be added in a future update. You can still create custom datasets manually.
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Dataset Templates</h2>
        <Button variant="outline" onClick={onRefresh} size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Available Templates</CardTitle>
          <CardDescription>
            Use these templates to quickly create datasets for common scenarios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>{getQueryTypeBadge(template.query_type)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {template.description}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => createFromTemplate(template)}
                          disabled={creating}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create Dataset
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
    </div>
  );
};

export default DatasetTemplateList;
