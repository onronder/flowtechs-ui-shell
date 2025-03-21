
import { supabase } from "@/integrations/supabase/client";
import { QueryTemplate, QueryVariable } from "../types";
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

    return (data || []).map(template => ({
      id: template.id,
      name: template.name,
      description: template.description || '',
      query: template.query_details?.query || '',
      variables: template.query_details?.variables || [],
      source_id: sourceId, // Changed from sourceId to source_id to match QueryTemplate interface
      created_at: template.created_at,
      updated_at: template.updated_at,
      complexity: template.query_details?.complexity || 0
    }));
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
      }
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
    return {
      id: savedTemplate.id,
      name: savedTemplate.name,
      description: savedTemplate.description || '',
      query: savedTemplate.query_details.query,
      variables: savedTemplate.query_details.variables,
      source_id: sourceId, // Changed from sourceId to source_id
      created_at: savedTemplate.created_at,
      updated_at: savedTemplate.updated_at,
      complexity: savedTemplate.query_details.complexity
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
