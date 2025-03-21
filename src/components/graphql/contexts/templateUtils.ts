
import { supabase } from "@/integrations/supabase/client";
import { QueryTemplate, QueryVariable, QueryDetailsJson } from "../types";
import { Json } from "@/integrations/supabase/types";

export const fetchTemplates = async (sourceId: string): Promise<QueryTemplate[]> => {
  try {
    // Use the correct table name and query_type based on our database schema
    const { data, error } = await supabase
      .from('dataset_templates')
      .select('*')
      .eq('query_type', 'custom')  // Changed from 'graphql' to 'custom' as per the allowed enum values
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching templates:", error);
      return [];
    }

    return (data || []).map(template => {
      // Safely cast query_details to the correct type
      const queryDetails = template.query_details as Json;
      const details = queryDetails ? {
        query: typeof queryDetails === 'object' && queryDetails !== null ? (queryDetails as any).query || '' : '',
        variables: typeof queryDetails === 'object' && queryDetails !== null ? (queryDetails as any).variables || [] : [],
        complexity: typeof queryDetails === 'object' && queryDetails !== null ? (queryDetails as any).complexity || 0 : 0,
        execution_count: typeof queryDetails === 'object' && queryDetails !== null ? (queryDetails as any).execution_count : undefined,
        average_execution_time: typeof queryDetails === 'object' && queryDetails !== null ? (queryDetails as any).average_execution_time : undefined
      } : { query: '', variables: [], complexity: 0 };
      
      return {
        id: template.id,
        name: template.name,
        description: template.description || '',
        query: details.query,
        variables: details.variables,
        source_id: sourceId, // Changed from sourceId to source_id to match QueryTemplate interface
        created_at: template.created_at,
        updated_at: template.updated_at,
        complexity: details.complexity,
        execution_count: details.execution_count,
        average_execution_time: details.average_execution_time
      };
    });
  } catch (error) {
    console.error("Error parsing templates:", error);
    return [];
  }
};

export const saveTemplateToSupabase = async (
  data: any,
  query: string,
  variables: QueryVariable[],
  complexity: number,
  queryName: string,
  sourceId: string
): Promise<QueryTemplate | null> => {
  try {
    // Convert variables to a format compatible with Supabase's Json type
    const safeVariables = variables.map(v => ({
      name: v.name,
      type: v.type,
      defaultValue: v.defaultValue
    }));

    const templateData = {
      name: data.name,
      description: data.description,
      query_type: 'custom' as const, // Use 'custom' as the query type with type assertion
      query_name: queryName,
      query_details: {
        query,
        variables: safeVariables,
        complexity,
        sourceId
      } as Json // Cast to Json to satisfy the type system
    };

    const { data: savedTemplate, error } = await supabase
      .from('dataset_templates')
      .insert(templateData)
      .select()
      .single();

    if (error) {
      console.error("Error saving template:", error);
      throw error;
    }

    // Convert the saved template to our expected format
    const queryDetails = savedTemplate.query_details as Json;
    const details = queryDetails ? {
      query: typeof queryDetails === 'object' && queryDetails !== null ? (queryDetails as any).query || '' : '',
      variables: typeof queryDetails === 'object' && queryDetails !== null ? (queryDetails as any).variables || [] : [],
      complexity: typeof queryDetails === 'object' && queryDetails !== null ? (queryDetails as any).complexity || 0 : 0
    } : { query: '', variables: [], complexity: 0 };
    
    return {
      id: savedTemplate.id,
      name: savedTemplate.name,
      description: savedTemplate.description || '',
      query: details.query,
      variables: details.variables,
      source_id: sourceId, // Changed from sourceId to source_id
      created_at: savedTemplate.created_at,
      updated_at: savedTemplate.updated_at,
      complexity: details.complexity
    };
  } catch (error) {
    console.error("Error saving template:", error);
    return null;
  }
};

export const parseTemplateQuery = (template: QueryTemplate, setQueryName: (name: string) => void) => {
  try {
    // Extract operation name from the query
    const operationNameMatch = template.query.match(/query\s+(\w+)/);
    if (operationNameMatch && operationNameMatch[1]) {
      setQueryName(operationNameMatch[1]);
    }

    // If we couldn't extract operation name, use the template name
    if (!operationNameMatch && template.name) {
      setQueryName(template.name.replace(/\s+/g, ''));
    }
  } catch (error) {
    console.error("Error parsing template query:", error);
  }
};
