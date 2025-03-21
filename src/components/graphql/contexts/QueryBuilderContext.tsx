
import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { TypeField, QueryVariable, QueryTemplate, QueryResult } from "../types";
import { SchemaType, SchemaField } from "../types/schemaTypes";
import { toast } from "@/components/ui/use-toast";
import { generateGraphQLQuery } from "../utils/queryUtils";
import { SelectedFieldsType, QueryBuilderContextType } from "./types";
import { getBaseType, getTypeName, convertSchemaTypeToFields } from "./queryBuilderUtils";
import { fetchTemplates, saveTemplateToSupabase, parseTemplateQuery } from "./templateUtils";
import { executeQueryOnSupabase } from "./queryExecutionUtils";

const QueryBuilderContext = createContext<QueryBuilderContextType | undefined>(undefined);

export const QueryBuilderProvider = ({ 
  children, 
  sourceId 
}: { 
  children: ReactNode; 
  sourceId: string 
}) => {
  const [selectedType, setSelectedType] = useState<SchemaType | null>(null);
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
    const loadTemplates = async () => {
      const loadedTemplates = await fetchTemplates(sourceId);
      setTemplates(loadedTemplates);
    };
    
    loadTemplates();
  }, [sourceId]);

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
  }, [fields, queryName]);

  const handleTypeSelect = (type: SchemaType) => {
    setSelectedType(type);
    
    if (type.fields) {
      const convertedFields = convertSchemaTypeToFields(type);
      setFields(convertedFields);
    }
  };

  const handleFieldSelect = (schemaField: SchemaField, parentType: SchemaType) => {
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
      const savedTemplate = await saveTemplateToSupabase(
        data,
        generatedQuery,
        queryVariables,
        complexity,
        queryName,
        sourceId
      );
      
      if (savedTemplate) {
        setTemplates(prev => [savedTemplate, ...prev]);
        
        toast({
          title: "Template saved",
          description: "Your query template has been saved successfully."
        });
      } else {
        throw new Error("Failed to save template");
      }
      
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
      parseTemplateQuery(template, setQueryName);
      
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
    setIsExecuting(true);
    setErrorMessage(null);
    setQueryResult(null);
    
    try {
      const { result, error, executionTime } = await executeQueryOnSupabase(
        sourceId,
        generatedQuery,
        queryVariables
      );
      
      setExecutionTime(executionTime);
      
      if (error) {
        setErrorMessage(error);
        toast({
          variant: "destructive",
          title: "Query execution failed",
          description: error
        });
        return;
      }
      
      if (result) {
        setQueryResult(result);
        
        toast({
          title: "Query executed",
          description: `Query completed in ${executionTime.toFixed(0)}ms`
        });
      }
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
