
import { supabase } from "@/integrations/supabase/client";
import { QueryTemplate, QueryVariable } from "../types";

export const fetchTemplates = async (sourceId: string): Promise<QueryTemplate[]> => {
  try {
    // Use the correct table name based on our database schema
    const { data, error } = await supabase
      .from('dataset_templates')
      .select('*')
      .eq('query_type', 'graphql')
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
      sourceId: sourceId,
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
    const templateData = {
      name: data.name,
      description: data.description,
      query_type: 'graphql',
      query_name: queryName,
      query_details: {
        query,
        variables,
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

    return {
      id: savedTemplate.id,
      name: savedTemplate.name,
      description: savedTemplate.description || '',
      query: savedTemplate.query_details.query,
      variables: savedTemplate.query_details.variables,
      sourceId,
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
