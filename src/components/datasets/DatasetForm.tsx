
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/components/ui/use-toast";
import { supabase, Source, Dataset, QueryType } from "@/integrations/supabase/client";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react";
import { DatasetPreview } from "./DatasetPreview";

// Form validation schema
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  source_id: z.string().min(1, "Source is required"),
  query_type: z.enum(["product", "order", "customer", "inventory", "collection", "custom"] as const),
  query_name: z.string().min(1, "Query name is required"),
  query_details: z.record(z.any()).optional(),
  include_variants: z.boolean().default(true),
  include_images: z.boolean().default(true),
  include_metafields: z.boolean().default(false),
  include_line_items: z.boolean().default(true),
  include_fulfillments: z.boolean().default(true),
  include_addresses: z.boolean().default(true),
  date_range: z.enum(["30d", "90d", "all"]).default("30d"),
});

type FormValues = z.infer<typeof formSchema>;

const DatasetForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [sources, setSources] = useState<Source[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const isEditMode = !!id && id !== "new";

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      source_id: "",
      query_type: "product",
      query_name: "products",
      include_variants: true,
      include_images: true,
      include_metafields: false,
      include_line_items: true,
      include_fulfillments: true,
      include_addresses: true,
      date_range: "30d",
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch available Shopify sources
        const { data: sourcesData, error: sourcesError } = await supabase
          .from("sources")
          .select("*")
          .eq("type", "shopify")
          .eq("connection_status", "connected");

        if (sourcesError) throw sourcesError;
        setSources(sourcesData as Source[]);

        // Fetch available dataset templates
        const { data: templatesData, error: templatesError } = await supabase
          .from("dataset_templates")
          .select("*");

        if (templatesError) throw templatesError;
        setTemplates(templatesData);

        // If editing, fetch the dataset
        if (isEditMode) {
          const { data: dataset, error: datasetError } = await supabase
            .from("datasets")
            .select("*")
            .eq("id", id)
            .single();

          if (datasetError) throw datasetError;
          
          // Set form values from dataset, ensuring proper type handling for query_details
          // Cast query_details to Record<string, any> to safely access properties
          const queryDetails = dataset.query_details as Record<string, any> || {};
          
          form.reset({
            name: dataset.name,
            description: dataset.description || "",
            source_id: dataset.source_id,
            query_type: dataset.query_type as QueryType,
            query_name: dataset.query_name,
            include_variants: queryDetails.include_variants || false,
            include_images: queryDetails.include_images || false,
            include_metafields: queryDetails.include_metafields || false,
            include_line_items: queryDetails.include_line_items || false,
            include_fulfillments: queryDetails.include_fulfillments || false,
            include_addresses: queryDetails.include_addresses || false,
            date_range: queryDetails.date_range || "30d",
          });
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          variant: "destructive",
          title: "Failed to load data",
          description: "There was an error loading the page data.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, isEditMode, form]);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    
    try {
      // Construct query details from form values
      const queryDetails = {
        include_variants: values.include_variants,
        include_images: values.include_images,
        include_metafields: values.include_metafields,
        include_line_items: values.include_line_items,
        include_fulfillments: values.include_fulfillments,
        include_addresses: values.include_addresses,
        date_range: values.date_range,
      };
      
      const datasetData = {
        name: values.name,
        description: values.description || null,
        source_id: values.source_id,
        query_type: values.query_type,
        query_name: values.query_name,
        query_details: queryDetails,
        status: "pending",
      };
      
      if (isEditMode) {
        // Update existing dataset
        const { error } = await supabase
          .from("datasets")
          .update(datasetData)
          .eq("id", id);
          
        if (error) throw error;
        
        toast({
          title: "Dataset updated",
          description: "Your dataset has been updated successfully.",
        });
      } else {
        // Create new dataset
        const { error } = await supabase
          .from("datasets")
          .insert({ ...datasetData, user_id: (await supabase.auth.getUser()).data.user?.id });
          
        if (error) throw error;
        
        toast({
          title: "Dataset created",
          description: "Your dataset has been created successfully.",
        });
      }
      
      // Navigate back to datasets list
      navigate("/datasets");
    } catch (error) {
      console.error("Error saving dataset:", error);
      toast({
        variant: "destructive",
        title: "Failed to save dataset",
        description: "There was an error saving your dataset.",
      });
    } finally {
      setSaving(false);
    }
  };

  const loadTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    
    const queryDetails = template.query_details || {};
    
    form.setValue("name", template.name);
    form.setValue("description", template.description || "");
    form.setValue("query_type", template.query_type);
    form.setValue("query_name", template.query_name);
    form.setValue("include_variants", queryDetails.include_variants || false);
    form.setValue("include_images", queryDetails.include_images || false);
    form.setValue("include_metafields", queryDetails.include_metafields || false);
    form.setValue("include_line_items", queryDetails.include_line_items || false);
    form.setValue("include_fulfillments", queryDetails.include_fulfillments || false);
    form.setValue("include_addresses", queryDetails.include_addresses || false);
    form.setValue("date_range", queryDetails.date_range || "30d");
  };

  const handleFetchPreview = async () => {
    const values = form.getValues();
    
    if (!values.source_id) {
      toast({
        variant: "destructive",
        title: "Source required",
        description: "Please select a source before fetching preview data.",
      });
      return;
    }
    
    setPreviewLoading(true);
    setShowPreview(true);
    
    try {
      // Create temporary extraction log for the preview
      const { data: logData, error: logError } = await supabase
        .from("extraction_logs")
        .insert({
          dataset_id: id || "preview",
          status: "running",
        })
        .select();
        
      if (logError) throw logError;
      
      const extractionLogId = logData?.[0]?.id;
      
      // Construct query details from form values
      const queryDetails = {
        include_variants: values.include_variants,
        include_images: values.include_images,
        include_metafields: values.include_metafields,
        include_line_items: values.include_line_items,
        include_fulfillments: values.include_fulfillments,
        include_addresses: values.include_addresses,
        date_range: values.date_range,
      };
      
      // Call the edge function to fetch preview data
      const response = await supabase.functions.invoke('extract-shopify-data', {
        body: {
          sourceId: values.source_id,
          datasetId: id || "preview",
          queryType: values.query_type,
          queryName: values.query_name,
          queryDetails,
          extractionLogId,
          sampleOnly: true
        }
      });
      
      if (response.error) throw new Error(response.error.message);
      
      setPreviewData(response.data);
    } catch (error) {
      console.error("Error fetching preview:", error);
      toast({
        variant: "destructive",
        title: "Preview failed",
        description: error instanceof Error ? error.message : "There was an error fetching the preview data.",
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Button 
          variant="ghost" 
          className="mr-2"
          onClick={() => navigate("/datasets")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h2 className="text-2xl font-bold">
          {isEditMode ? "Edit Dataset" : "Create New Dataset"}
        </h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dataset Information</CardTitle>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My Dataset" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="source_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a source" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sources.length === 0 ? (
                            <SelectItem value="none" disabled>
                              No available sources
                            </SelectItem>
                          ) : (
                            sources.map((source) => (
                              <SelectItem key={source.id} value={source.id}>
                                {source.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optional description of what this dataset contains"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {templates.length > 0 && (
                <div className="mt-4">
                  <FormLabel>Use Template</FormLabel>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                    {templates.map(template => (
                      <Card key={template.id} className="cursor-pointer hover:border-primary transition-colors"
                            onClick={() => loadTemplate(template.id)}>
                        <CardContent className="p-4">
                          <h3 className="font-semibold">{template.name}</h3>
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="query_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Query Type</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(value: QueryType) => {
                          field.onChange(value);
                          // Update query name based on type
                          form.setValue("query_name", value === "product" ? "products" : 
                                                    value === "order" ? "orders" : 
                                                    value === "customer" ? "customers" : 
                                                    value === "inventory" ? "inventory" : 
                                                    "collections");
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select data type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="product">Products</SelectItem>
                          <SelectItem value="order">Orders</SelectItem>
                          <SelectItem value="customer">Customers</SelectItem>
                          <SelectItem value="inventory">Inventory</SelectItem>
                          <SelectItem value="collection">Collections</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div>
                <h3 className="text-base font-semibold mb-3">Query Options</h3>
                <div className="space-y-4">
                  {form.watch("query_type") === "product" && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="include_variants"
                        render={({ field }) => (
                          <FormItem className="flex items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Include Variants</FormLabel>
                              <FormDescription>
                                Fetch product variants data
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="include_images"
                        render={({ field }) => (
                          <FormItem className="flex items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Include Images</FormLabel>
                              <FormDescription>
                                Fetch product images data
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="include_metafields"
                        render={({ field }) => (
                          <FormItem className="flex items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Include Metafields</FormLabel>
                              <FormDescription>
                                Fetch product metafields
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                  
                  {form.watch("query_type") === "order" && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="include_line_items"
                          render={({ field }) => (
                            <FormItem className="flex items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Include Line Items</FormLabel>
                                <FormDescription>
                                  Fetch order line items
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="include_fulfillments"
                          render={({ field }) => (
                            <FormItem className="flex items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Include Fulfillments</FormLabel>
                                <FormDescription>
                                  Fetch order fulfillment data
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="date_range"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date Range</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger className="w-[250px]">
                                  <SelectValue placeholder="Select date range" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="30d">Last 30 Days</SelectItem>
                                <SelectItem value="90d">Last 90 Days</SelectItem>
                                <SelectItem value="all">All Time</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Time period for order data
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                  
                  {form.watch("query_type") === "customer" && (
                    <FormField
                      control={form.control}
                      name="include_addresses"
                      render={({ field }) => (
                        <FormItem className="flex items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Include Addresses</FormLabel>
                            <FormDescription>
                              Fetch customer address data
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button 
                type="button" 
                variant="outline"
                onClick={handleFetchPreview}
                disabled={previewLoading}
              >
                {previewLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Preview Data
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? "Update Dataset" : "Create Dataset"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      {showPreview && (
        <DatasetPreview 
          data={previewData} 
          loading={previewLoading}
          queryType={form.watch("query_type")}
        />
      )}
    </div>
  );
};

export default DatasetForm;
