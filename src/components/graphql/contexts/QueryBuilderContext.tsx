
import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { TypeField, QueryVariable, QueryTemplate, QueryResult } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { generateGraphQLQuery } from "../utils/queryUtils";

// Define a simpler SelectedFieldsType to avoid excessive type recursion
export type SelectedFieldsType = Record<string, Set<string>>;

type QueryBuilderContextType = {
  sourceId: string;
  selectedType: any;
  setSelectedType: (type: any) => void;
  fields: TypeField[];
  setFields: (fields: TypeField[]) => void;
  generatedQuery: string;
  queryVariables: QueryVariable[];
  selectedFields: SelectedFieldsType;
  setSelectedFields: (fields: SelectedFieldsType) => void;
  queryName: string;
  setQueryName: (name: string) => void;
  complexity: number;
  templates: QueryTemplate[];
  queryResult: QueryResult | null;
  isExecuting: boolean;
  executionTime: number | null;
  errorMessage: string | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  saveDialogOpen: boolean;
  setSaveDialogOpen: (open: boolean) => void;
  handleTypeSelect: (type: any) => void;
  handleFieldSelect: (schemaField: any, parentType: any) => void;
  handleVariableChange: (index: number, field: keyof QueryVariable, value: string) => void;
  saveTemplate: (data: any) => Promise<void>;
  loadTemplate: (template: QueryTemplate) => void;
  executeQuery: () => Promise<void>;
  copyToClipboard: (text: string) => void;
};

const QueryBuilderContext = createContext<QueryBuilderContextType | undefined>(undefined);

export const QueryBuilderProvider = ({ children, sourceId }: { children: ReactNode; sourceId: string }) => {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<any>(null);
  const [fields, setFields] = useState<TypeField[]>([]);
  const [generatedQuery, setGeneratedQuery] = useState("");
  const [queryVariables, setQueryVariables] = useState<QueryVariable[]>([]);
  const [selectedFields, setSelectedFields] = useState<SelectedFieldsType>({});
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
          const queryDetails = item.query_details as Record<string, any> | null;
          
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
      const convertedFields = type.fields.map((field: any) => {
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
      setFields(convertedFields);
    }
  };

  const getBaseType = (typeRef: any): any => {
    if (!typeRef.ofType) return typeRef;
    return getBaseType(typeRef.ofType);
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
      const queryDetailsObject = {
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
        query_details: queryDetailsObject,
        source_id: sourceId
      };

      const { data: savedTemplate, error } = await supabase
        .from('dataset_templates')
        .insert(templateData)
        .select()
        .single();
        
      if (error) throw error;
      
      if (!savedTemplate) throw new Error("No template data returned from insert");
      
      const queryDetails = savedTemplate.query_details as Record<string, any> | null;
      
      const mappedTemplate: QueryTemplate = {
        id: savedTemplate.id,
        name: savedTemplate.name,
        description: savedTemplate.description,
        query: queryDetails?.query || "",
        variables: queryDetails?.variables || [],
        complexity: queryDetails?.complexity || 0,
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

  return (
    <QueryBuilderContext.Provider
      value={{
        sourceId,
        selectedType,
        setSelectedType,
        fields,
        setFields,
        generatedQuery,
        queryVariables,
        selectedFields,
        setSelectedFields,
        queryName,
        setQueryName,
        complexity,
        templates,
        queryResult,
        isExecuting,
        executionTime,
        errorMessage,
        activeTab,
        setActiveTab,
        saveDialogOpen,
        setSaveDialogOpen,
        handleTypeSelect,
        handleFieldSelect,
        handleVariableChange,
        saveTemplate,
        loadTemplate,
        executeQuery,
        copyToClipboard
      }}
    >
      {children}
    </QueryBuilderContext.Provider>
  );
};

export const useQueryBuilder = () => {
  const context = useContext(QueryBuilderContext);
  if (context === undefined) {
    throw new Error("useQueryBuilder must be used within a QueryBuilderProvider");
  }
  return context;
};
