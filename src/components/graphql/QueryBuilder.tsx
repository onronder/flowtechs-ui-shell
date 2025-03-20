import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import SchemaExplorer from "./SchemaExplorer";
import FieldsTree from "./FieldsTree";
import QueryVariables from "./QueryVariables";
import QueryTemplates from "./QueryTemplates";
import QueryResults from "./QueryResults";
import QueryEditor from "./QueryEditor";
import SaveTemplateDialog from "./SaveTemplateDialog";
import { TypeField, QueryVariable, QueryTemplate, QueryResult, QueryDetailsJson } from "./types";
import { convertSchemaTypeToFields, generateGraphQLQuery } from "./utils/queryUtils";
import { Json } from "@/integrations/supabase/types";

interface QueryBuilderProps {
  sourceId: string;
}

const QueryBuilder = ({ sourceId }: QueryBuilderProps) => {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<any>(null);
  const [fields, setFields] = useState<TypeField[]>([]);
  const [generatedQuery, setGeneratedQuery] = useState("");
  const [queryVariables, setQueryVariables] = useState<QueryVariable[]>([]);
  const [selectedFields, setSelectedFields] = useState<Record<string, Set<string>>>({});
  const [queryName, setQueryName] = useState("myQuery");
  const [activeTab, setActiveTab] = useState("builder");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templates, setTemplates] = useState<QueryTemplate[]>([]);
  const [complexity, setComplexity] = useState(0);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchTemplates = async () => {
      if (!sourceId) return;
      
      try {
        const { data, error } = await supabase
          .from('dataset_templates')
          .select('*')
          .eq('source_id', sourceId)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        
        if (!data) return;
        
        const mappedTemplates = data.map(item => {
          const queryDetails = item.query_details as Json as unknown as QueryDetailsJson;
          
          return {
            id: item.id,
            name: item.name,
            description: item.description,
            query: queryDetails?.query || "",
            variables: queryDetails?.variables || [],
            complexity: queryDetails?.complexity || 0,
            source_id: sourceId,
            created_at: item.created_at,
            updated_at: item.updated_at,
            execution_count: queryDetails?.execution_count,
            average_execution_time: queryDetails?.average_execution_time
          } as QueryTemplate;
        });
        
        setTemplates(mappedTemplates);
      } catch (error) {
        console.error("Error fetching templates:", error);
        toast({
          variant: "destructive",
          title: "Failed to load templates",
          description: "There was an error loading saved query templates."
        });
      }
    };
    
    fetchTemplates();
  }, [sourceId, toast]);

  useEffect(() => {
    if (fields.length === 0) return;
    
    try {
      const { query, variables, complexity } = generateGraphQLQuery(fields, queryName);
      setGeneratedQuery(query);
      setQueryVariables(variables);
      setComplexity(complexity);
    } catch (error) {
      console.error("Error generating query:", error);
      toast({
        variant: "destructive",
        title: "Query generation failed",
        description: "There was an error generating the GraphQL query."
      });
    }
  }, [fields, queryName, toast]);

  const handleTypeSelect = (type: any) => {
    setSelectedType(type);
    
    if (type.fields) {
      setFields(convertSchemaTypeToFields(type));
    }
  };

  const handleFieldSelect = (schemaField: any, parentType: any) => {
    setSelectedFields(prev => {
      const fieldSet = prev[parentType.name] || new Set();
      if (fieldSet.has(schemaField.name)) {
        fieldSet.delete(schemaField.name);
      } else {
        fieldSet.add(schemaField.name);
      }
      return { ...prev, [parentType.name]: fieldSet };
    });
    
    if (parentType.name === selectedType?.name) {
      setFields(prev => {
        return prev.map(field => {
          if (field.name === schemaField.name) {
            return { ...field, selected: !field.selected };
          }
          return field;
        });
      });
    }
  };

  const handleVariableChange = (index: number, field: keyof QueryVariable, value: string) => {
    setQueryVariables(prev => {
      const newVars = [...prev];
      newVars[index] = { ...newVars[index], [field]: value };
      return newVars;
    });
  };

  const saveTemplate = async (data: any) => {
    try {
      const queryDetailsObject: Record<string, any> = {
        query: generatedQuery,
        variables: queryVariables.map(v => ({
          name: v.name,
          type: v.type,
          defaultValue: v.defaultValue
        })),
        complexity: complexity
      };
      
      const templateData = {
        name: data.templateName,
        description: data.templateDescription,
        query_type: "custom" as const,
        query_name: queryName,
        query_details: queryDetailsObject as unknown as Json,
        source_id: sourceId
      };

      const { data: savedTemplate, error } = await supabase
        .from('dataset_templates')
        .insert(templateData)
        .select()
        .single();
        
      if (error) throw error;
      
      if (!savedTemplate) throw new Error("No template data returned from insert");
      
      const rawQueryDetails = savedTemplate.query_details as Json;
      const queryDetails = typeof rawQueryDetails === 'object' 
        ? (rawQueryDetails as unknown as QueryDetailsJson)
        : { query: "", variables: [], complexity: 0 };
      
      const mappedTemplate: QueryTemplate = {
        id: savedTemplate.id,
        name: savedTemplate.name,
        description: savedTemplate.description,
        query: queryDetails.query || "",
        variables: queryDetails.variables || [],
        complexity: queryDetails.complexity || 0,
        source_id: sourceId,
        created_at: savedTemplate.created_at,
        updated_at: savedTemplate.updated_at
      };
      
      setTemplates(prev => [mappedTemplate, ...prev]);
      
      toast({
        title: "Template saved",
        description: "Your query template has been saved successfully."
      });
      
      setSaveDialogOpen(false);
    } catch (error) {
      console.error("Error saving template:", error);
      toast({
        variant: "destructive",
        title: "Failed to save template",
        description: "There was an error saving your query template."
      });
    }
  };

  const loadTemplate = (template: QueryTemplate) => {
    try {
      const lines = template.query.split('\n');
      const queryNameLine = lines[0];
      const queryNameMatch = queryNameLine.match(/query\s+([a-zA-Z0-9_]+)/);
      
      if (queryNameMatch && queryNameMatch[1]) {
        setQueryName(queryNameMatch[1]);
      }
      
      setQueryVariables(template.variables || []);
      
      setGeneratedQuery(template.query);
      
      toast({
        title: "Template loaded",
        description: "Query template has been loaded."
      });
      
      setActiveTab("query");
    } catch (error) {
      console.error("Error loading template:", error);
      toast({
        variant: "destructive",
        title: "Failed to load template",
        description: "There was an error loading the query template."
      });
    }
  };

  const executeQuery = async () => {
    if (!sourceId || !generatedQuery) return;
    
    setIsExecuting(true);
    setErrorMessage(null);
    setQueryResult(null);
    
    try {
      const startTime = performance.now();
      
      const variables = queryVariables.reduce((obj, variable) => {
        obj[variable.name] = variable.defaultValue;
        return obj;
      }, {} as Record<string, any>);
      
      const response = await supabase.functions.invoke('execute-shopify-query', {
        body: {
          sourceId,
          query: generatedQuery,
          variables
        }
      });
      
      const endTime = performance.now();
      setExecutionTime(endTime - startTime);
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Query execution failed');
      }
      
      setQueryResult(response.data);
      
      toast({
        title: "Query executed",
        description: `Query completed in ${(endTime - startTime).toFixed(0)}ms`
      });
    } catch (error) {
      console.error("Error executing query:", error);
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
      toast({
        variant: "destructive",
        title: "Query execution failed",
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Query has been copied to clipboard."
    });
  };

  const getComplexityColor = () => {
    if (complexity < 10) return "bg-green-500";
    if (complexity < 20) return "bg-yellow-500";
    return "bg-red-500";
  };
  
  return (
    <div className="h-full">
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle>Shopify GraphQL Query Builder</CardTitle>
        </CardHeader>
        
        <CardContent className="h-[calc(100%-8rem)]">
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={30} minSize={20}>
              <div className="h-full overflow-hidden">
                <Label className="mb-2 block">Schema Explorer</Label>
                <SchemaExplorer 
                  sourceId={sourceId}
                  onTypeSelect={handleTypeSelect}
                  onFieldSelect={handleFieldSelect}
                  selectedFields={selectedFields}
                />
              </div>
            </ResizablePanel>
            
            <ResizableHandle withHandle />
            
            <ResizablePanel defaultSize={70}>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="builder">Field Selection</TabsTrigger>
                  <TabsTrigger value="query">GraphQL Query</TabsTrigger>
                  <TabsTrigger value="variables">Variables</TabsTrigger>
                  <TabsTrigger value="templates">Templates</TabsTrigger>
                  <TabsTrigger value="results">Results</TabsTrigger>
                </TabsList>
                
                <TabsContent value="builder" className="h-[calc(100vh-18rem)] overflow-auto">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="query-name">Query Name:</Label>
                        <Input
                          id="query-name"
                          value={queryName}
                          onChange={(e) => setQueryName(e.target.value)}
                          className="w-48"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="text-sm">Complexity:</div>
                        <Badge className={getComplexityColor()}>
                          {complexity}
                        </Badge>
                      </div>
                    </div>
                    
                    {selectedType ? (
                      <Card>
                        <CardHeader className="py-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-base">
                                {selectedType.name}
                              </CardTitle>
                              <p className="text-xs text-muted-foreground">
                                Select fields to include in your query
                              </p>
                            </div>
                            <Badge variant="outline">
                              {fields.filter(f => f.selected).length} / {fields.length} fields
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[calc(100vh-24rem)]">
                            <FieldsTree 
                              fields={fields}
                              onFieldsChange={setFields}
                              sourceId={sourceId}
                            />
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          Select a type from the Schema Explorer to begin building your query.
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="query">
                  <QueryEditor 
                    generatedQuery={generatedQuery}
                    isExecuting={isExecuting}
                    onExecute={executeQuery}
                    onCopy={copyToClipboard}
                    onSave={() => setSaveDialogOpen(true)}
                  />
                </TabsContent>
                
                <TabsContent value="variables">
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Query Variables</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <QueryVariables 
                          variables={queryVariables}
                          onVariableChange={handleVariableChange}
                        />
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                
                <TabsContent value="templates">
                  <div className="space-y-4">
                    <QueryTemplates 
                      templates={templates}
                      onLoadTemplate={loadTemplate}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="results">
                  <div className="space-y-4">
                    <QueryResults 
                      isExecuting={isExecuting}
                      errorMessage={errorMessage}
                      queryResult={queryResult}
                      executionTime={executionTime}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </ResizablePanel>
          </ResizablePanelGroup>
        </CardContent>
      </Card>
      
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <SaveTemplateDialog 
          onSave={saveTemplate}
          onCancel={() => setSaveDialogOpen(false)}
        />
      </Dialog>
    </div>
  );
};

export default QueryBuilder;
