
import { useState, useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { 
  Trash2, 
  Plus, 
  ChevronRight, 
  ChevronDown, 
  Bookmark,
  Save,
  Copy,
  PlayCircle,
  AlertCircle,
  X,
  Check,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Info
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import SchemaExplorer from "./SchemaExplorer";

interface QueryBuilderProps {
  sourceId: string;
}

interface TypeField {
  name: string;
  type: string;
  description: string | null;
  args: FieldArgument[];
  selected: boolean;
  subfields?: TypeField[];
  expanded?: boolean;
  isDeprecated?: boolean;
  deprecationReason?: string | null;
}

interface FieldArgument {
  name: string;
  type: string;
  description: string | null;
  defaultValue: string | null;
  value?: string;
}

interface QueryVariable {
  name: string;
  type: string;
  defaultValue: string;
}

interface QueryTemplate {
  id: string;
  name: string;
  description: string | null;
  query: string;
  variables: QueryVariable[];
  complexity: number;
  source_id: string;
  created_at: string;
  updated_at: string;
  execution_count?: number;
  average_execution_time?: number;
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
  const [fieldLimit, setFieldLimit] = useState(25);
  const [queryResult, setQueryResult] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const form = useForm({
    defaultValues: {
      templateName: "",
      templateDescription: "",
    }
  });

  // Fetch saved templates
  useEffect(() => {
    const fetchTemplates = async () => {
      if (!sourceId) return;
      
      try {
        const { data, error } = await supabase
          .from('query_templates')
          .select('*')
          .eq('source_id', sourceId)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        
        setTemplates(data as QueryTemplate[]);
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

  // Generate GraphQL query based on selected fields
  useEffect(() => {
    if (fields.length === 0) return;
    
    try {
      const variables: QueryVariable[] = [];
      let complexityScore = 0;
      
      const generateFieldString = (fields: TypeField[], indent = 2): string => {
        return fields
          .filter(field => field.selected)
          .map(field => {
            complexityScore += 1;
            
            // Handle field arguments
            const args = field.args
              .filter(arg => arg.value && arg.value.trim() !== '')
              .map(arg => {
                // Check if this is a variable
                if (arg.value?.startsWith('$')) {
                  const varName = arg.value.substring(1);
                  // Add to variables if not already there
                  if (!variables.some(v => v.name === varName)) {
                    variables.push({
                      name: varName,
                      type: arg.type,
                      defaultValue: ''
                    });
                  }
                  return `${arg.name}: ${arg.value}`;
                }
                
                // Handle different value types
                let formattedValue = arg.value || '';
                if (arg.type.includes('Int') || arg.type.includes('Float')) {
                  formattedValue = arg.value || '0';
                } else if (arg.type.includes('Boolean')) {
                  formattedValue = arg.value === 'true' ? 'true' : 'false';
                } else {
                  // It's a string or enum
                  formattedValue = `"${arg.value}"`;
                }
                
                return `${arg.name}: ${formattedValue}`;
              })
              .join(', ');
              
            const argsString = args ? `(${args})` : '';
            
            // If field has subfields and they're selected
            if (field.subfields && field.subfields.some(sf => sf.selected)) {
              complexityScore += 2; // Additional complexity for nested fields
              const subfieldStr = generateFieldString(field.subfields, indent + 2);
              return `${' '.repeat(indent)}${field.name}${argsString} {\n${subfieldStr}\n${' '.repeat(indent)}}`;
            }
            
            return `${' '.repeat(indent)}${field.name}${argsString}`;
          })
          .join('\n');
      };
      
      let query = `query ${queryName}`;
      
      // Add variable declarations if needed
      if (variables.length > 0) {
        const variableDeclarations = variables
          .map(v => `$${v.name}: ${v.type}`)
          .join(', ');
        query += `(${variableDeclarations})`;
      }
      
      query += ` {\n`;
      query += generateFieldString(fields);
      query += `\n}`;
      
      setGeneratedQuery(query);
      setQueryVariables(variables);
      setComplexity(complexityScore);
    } catch (error) {
      console.error("Error generating query:", error);
      toast({
        variant: "destructive",
        title: "Query generation failed",
        description: "There was an error generating the GraphQL query."
      });
    }
  }, [fields, queryName]);

  const handleTypeSelect = (type: any) => {
    setSelectedType(type);
    
    // Convert type fields to our internal format
    if (type.fields) {
      const typeFields: TypeField[] = type.fields.map((field: any) => {
        const getBaseType = (typeRef: any): any => {
          if (!typeRef.ofType) return typeRef;
          return getBaseType(typeRef.ofType);
        };
        
        const baseType = getBaseType(field.type);
        const isObjectType = baseType.kind === 'OBJECT' || baseType.kind === 'INTERFACE';
        
        return {
          name: field.name,
          type: getTypeName(field.type),
          description: field.description,
          args: field.args.map((arg: any) => ({
            name: arg.name,
            type: getTypeName(arg.type),
            description: arg.description,
            defaultValue: arg.defaultValue,
            value: ''
          })),
          selected: false,
          expanded: false,
          isDeprecated: field.isDeprecated,
          deprecationReason: field.deprecationReason,
          subfields: isObjectType ? [] : undefined
        };
      });
      
      setFields(typeFields);
    }
  };

  const getTypeName = (typeRef: any): string => {
    if (typeRef.kind === 'NON_NULL') {
      return `${getTypeName(typeRef.ofType)}!`;
    }
    if (typeRef.kind === 'LIST') {
      return `[${getTypeName(typeRef.ofType)}]`;
    }
    return typeRef.name || 'Unknown';
  };

  const handleFieldSelect = (schemaField: any, parentType: any) => {
    // Update the selectedFields tracking
    setSelectedFields(prev => {
      const fieldSet = prev[parentType.name] || new Set();
      if (fieldSet.has(schemaField.name)) {
        fieldSet.delete(schemaField.name);
      } else {
        fieldSet.add(schemaField.name);
      }
      return { ...prev, [parentType.name]: fieldSet };
    });
    
    // If this is the root type, update our fields
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

  const toggleSubfields = async (field: TypeField, fieldIndex: number) => {
    // If subfields are already loaded, just toggle expanded state
    if (field.subfields && field.subfields.length > 0) {
      setFields(prev => {
        const newFields = [...prev];
        newFields[fieldIndex].expanded = !newFields[fieldIndex].expanded;
        return newFields;
      });
      return;
    }
    
    try {
      // We need to load the subfields from the schema
      const baseTypeName = field.type.replace(/[\[\]!]/g, '');
      
      // Find the type in the schema
      const response = await supabase.functions.invoke('introspect-shopify-schema', {
        body: { sourceId }
      });
      
      if (response.error || !response.data.success) {
        throw new Error(response.error?.message || response.data.error || 'Failed to load schema');
      }
      
      const schema = response.data.schema;
      const subType = schema.__schema.types.find((t: any) => t.name === baseTypeName);
      
      if (!subType || !subType.fields) {
        throw new Error(`Type ${baseTypeName} not found in schema or has no fields`);
      }
      
      // Convert fields to our format
      const subfields: TypeField[] = subType.fields.map((subfield: any) => {
        const getBaseType = (typeRef: any): any => {
          if (!typeRef.ofType) return typeRef;
          return getBaseType(typeRef.ofType);
        };
        
        const baseType = getBaseType(subfield.type);
        const isObjectType = baseType.kind === 'OBJECT' || baseType.kind === 'INTERFACE';
        
        return {
          name: subfield.name,
          type: getTypeName(subfield.type),
          description: subfield.description,
          args: subfield.args.map((arg: any) => ({
            name: arg.name,
            type: getTypeName(arg.type),
            description: arg.description,
            defaultValue: arg.defaultValue,
            value: ''
          })),
          selected: false,
          expanded: false,
          isDeprecated: subfield.isDeprecated,
          deprecationReason: subfield.deprecationReason,
          subfields: isObjectType ? [] : undefined
        };
      });
      
      // Update the field with subfields
      setFields(prev => {
        const newFields = [...prev];
        newFields[fieldIndex].subfields = subfields;
        newFields[fieldIndex].expanded = true;
        return newFields;
      });
    } catch (error) {
      console.error("Error loading subfields:", error);
      toast({
        variant: "destructive",
        title: "Failed to load subfields",
        description: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  const toggleFieldSelection = (fieldPath: string[], selected: boolean) => {
    setFields(prev => {
      const newFields = [...prev];
      let currentFields = newFields;
      let targetField = null;
      
      // Navigate to the correct nested level
      for (let i = 0; i < fieldPath.length; i++) {
        const fieldName = fieldPath[i];
        const fieldIndex = currentFields.findIndex(f => f.name === fieldName);
        
        if (fieldIndex === -1) break;
        
        if (i === fieldPath.length - 1) {
          // Found the target field
          targetField = currentFields[fieldIndex];
          targetField.selected = selected;
        } else {
          // Navigate deeper
          if (!currentFields[fieldIndex].subfields) break;
          currentFields = currentFields[fieldIndex].subfields!;
        }
      }
      
      return newFields;
    });
  };

  const handleArgumentChange = (fieldPath: string[], argName: string, value: string) => {
    setFields(prev => {
      const newFields = [...prev];
      let currentFields = newFields;
      let targetField = null;
      
      // Navigate to the correct nested level
      for (let i = 0; i < fieldPath.length; i++) {
        const fieldName = fieldPath[i];
        const fieldIndex = currentFields.findIndex(f => f.name === fieldName);
        
        if (fieldIndex === -1) break;
        
        if (i === fieldPath.length - 1) {
          // Found the target field
          targetField = currentFields[fieldIndex];
          const argIndex = targetField.args.findIndex(a => a.name === argName);
          if (argIndex !== -1) {
            targetField.args[argIndex].value = value;
          }
        } else {
          // Navigate deeper
          if (!currentFields[fieldIndex].subfields) break;
          currentFields = currentFields[fieldIndex].subfields!;
        }
      }
      
      return newFields;
    });
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
      const templateData = {
        name: data.templateName,
        description: data.templateDescription,
        query: generatedQuery,
        variables: queryVariables,
        complexity: complexity,
        source_id: sourceId
      };

      const { data: savedTemplate, error } = await supabase
        .from('query_templates')
        .insert(templateData)
        .select()
        .single();
        
      if (error) throw error;
      
      setTemplates(prev => [savedTemplate as QueryTemplate, ...prev]);
      
      toast({
        title: "Template saved",
        description: "Your query template has been saved successfully."
      });
      
      setSaveDialogOpen(false);
      form.reset();
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
      // Parse the query using a simple approach
      // For a production app, you'd want a proper GraphQL parser
      const lines = template.query.split('\n');
      const queryNameLine = lines[0];
      const queryNameMatch = queryNameLine.match(/query\s+([a-zA-Z0-9_]+)/);
      
      if (queryNameMatch && queryNameMatch[1]) {
        setQueryName(queryNameMatch[1]);
      }
      
      // Set variables from template
      setQueryVariables(template.variables || []);
      
      // For now, just set the query directly
      // In a real app, you'd want to reconstruct the field selection state
      setGeneratedQuery(template.query);
      
      toast({
        title: "Template loaded",
        description: "Query template has been loaded."
      });
      
      // Switch to query tab
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
      
      // Prepare variables for the query
      const variables = queryVariables.reduce((obj, variable) => {
        obj[variable.name] = variable.defaultValue;
        return obj;
      }, {} as Record<string, any>);
      
      // Call the execute query function
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

  const renderFieldsTree = (fields: TypeField[], path: string[] = []) => {
    return (
      <div className="space-y-1">
        {fields.map((field, index) => {
          const currentPath = [...path, field.name];
          const hasArgs = field.args && field.args.length > 0;
          const hasSubfields = field.subfields && field.subfields.length > 0;
          const isExpanded = field.expanded;
          
          return (
            <div key={field.name} className="field-item">
              <div className="flex items-center py-1">
                <div className="w-5">
                  <Checkbox
                    checked={field.selected}
                    onCheckedChange={(checked) => {
                      toggleFieldSelection(currentPath, checked === true);
                    }}
                    id={`field-${currentPath.join('-')}`}
                  />
                </div>
                
                <div className="ml-2 flex-grow">
                  <div className="flex items-center">
                    {field.subfields && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 p-0 mr-1"
                        onClick={() => toggleSubfields(field, index)}
                      >
                        {isExpanded ? 
                          <ChevronDown className="h-4 w-4" /> : 
                          <ChevronRight className="h-4 w-4" />
                        }
                      </Button>
                    )}
                    
                    <Label
                      htmlFor={`field-${currentPath.join('-')}`}
                      className={`text-sm ${field.isDeprecated ? 'line-through text-muted-foreground' : ''}`}
                    >
                      {field.name}
                      <span className="text-xs text-muted-foreground ml-2">
                        {field.type}
                      </span>
                    </Label>
                    
                    {field.isDeprecated && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertCircle className="h-3 w-3 ml-1 text-destructive" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Deprecated: {field.deprecationReason || 'No reason provided'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Field arguments */}
              {field.selected && hasArgs && (
                <div className="ml-7 mb-2">
                  {field.args.map(arg => (
                    <div key={arg.name} className="flex items-center mt-1">
                      <Label className="text-xs w-1/3">{arg.name}:</Label>
                      <Input
                        value={arg.value || ''}
                        onChange={(e) => handleArgumentChange(currentPath, arg.name, e.target.value)}
                        placeholder={arg.defaultValue || arg.type}
                        className="h-6 text-xs"
                      />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 ml-1 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{arg.description || 'No description'}</p>
                            <p className="text-xs mt-1">Type: {arg.type}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Render subfields if expanded */}
              {hasSubfields && isExpanded && (
                <div className="ml-5 pl-2 border-l">
                  {renderFieldsTree(field.subfields!, currentPath)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderQueryVariables = () => {
    if (queryVariables.length === 0) {
      return (
        <div className="text-center py-4 text-muted-foreground">
          No variables defined yet. Add arguments to fields to create variables.
        </div>
      );
    }
    
    return (
      <div className="space-y-3">
        {queryVariables.map((variable, index) => (
          <div key={index} className="flex items-center space-x-2">
            <div className="w-1/4">
              <Label htmlFor={`var-name-${index}`} className="text-xs">Name</Label>
              <Input
                id={`var-name-${index}`}
                value={variable.name}
                onChange={(e) => handleVariableChange(index, 'name', e.target.value)}
                className="h-8"
              />
            </div>
            <div className="w-1/4">
              <Label htmlFor={`var-type-${index}`} className="text-xs">Type</Label>
              <Input
                id={`var-type-${index}`}
                value={variable.type}
                onChange={(e) => handleVariableChange(index, 'type', e.target.value)}
                className="h-8"
                disabled
              />
            </div>
            <div className="w-2/4">
              <Label htmlFor={`var-default-${index}`} className="text-xs">Default Value</Label>
              <Input
                id={`var-default-${index}`}
                value={variable.defaultValue}
                onChange={(e) => handleVariableChange(index, 'defaultValue', e.target.value)}
                className="h-8"
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Calculate a color based on complexity
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
                        {complexity > 20 && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
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
                            {renderFieldsTree(fields)}
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
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => copyToClipboard(generatedQuery)}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSaveDialogOpen(true)}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Save as Template
                        </Button>
                      </div>
                      <Button 
                        onClick={executeQuery}
                        disabled={isExecuting || !generatedQuery}
                      >
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Execute Query
                      </Button>
                    </div>
                    
                    <Card>
                      <CardContent className="p-0">
                        <ScrollArea className="h-[calc(100vh-20rem)]">
                          <pre className="font-mono text-sm p-4 overflow-x-auto whitespace-pre">
                            {generatedQuery}
                          </pre>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                
                <TabsContent value="variables">
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Query Variables</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {renderQueryVariables()}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                
                <TabsContent value="templates">
                  <div className="space-y-4">
                    {templates.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          No saved templates yet. Build a query and save it as a template.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {templates.map((template) => (
                          <Card key={template.id} className="cursor-pointer hover:border-primary" onClick={() => loadTemplate(template)}>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base">{template.name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground">
                                {template.description || 'No description'}
                              </p>
                              <div className="flex justify-between items-center mt-2">
                                <Badge variant="outline">
                                  Complexity: {template.complexity}
                                </Badge>
                                <p className="text-xs text-muted-foreground">
                                  Created: {new Date(template.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="results">
                  <div className="space-y-4">
                    {isExecuting ? (
                      <div className="flex justify-center items-center py-12">
                        <div className="text-center">
                          <div className="mb-2">
                            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
                          </div>
                          <p>Executing query...</p>
                        </div>
                      </div>
                    ) : errorMessage ? (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>
                          {errorMessage}
                        </AlertDescription>
                      </Alert>
                    ) : queryResult ? (
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
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          Execute a query to see results here.
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </ResizablePanel>
          </ResizablePanelGroup>
        </CardContent>
      </Card>
      
      {/* Save Template Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Query Template</DialogTitle>
          </DialogHeader>
          
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(saveTemplate)}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="templateName">Name</Label>
                  <Input 
                    id="templateName"
                    {...form.register("templateName", { required: true })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="templateDescription">Description</Label>
                  <Textarea 
                    id="templateDescription"
                    {...form.register("templateDescription")}
                  />
                </div>
              </div>
              
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setSaveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Template</Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QueryBuilder;
