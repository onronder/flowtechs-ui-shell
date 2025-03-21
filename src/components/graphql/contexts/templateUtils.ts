
import { supabase } from "@/integrations/supabase/client";
import { QueryTemplate, QueryDetailsJson } from "../types";
import { QueryVariable } from "../types/core";

// Save query template to Supabase
export const saveTemplateToSupabase = async (
  data: any,
  query: string,
  variables: QueryVariable[],
  complexity: number,
  queryName: string,
  sourceId: string
): Promise<QueryTemplate | null> => {
  try {
    const details: QueryDetailsJson = {
      query,
      variables,
      complexity
    };
    
    const { data: savedTemplate, error } = await supabase
      .from('shopify_query_templates')
      .insert({
        name: data.templateName,
        description: data.templateDescription,
        source_id: sourceId,
        details: details,
        complexity
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to save template: ${error.message}`);
    }
    
    if (!savedTemplate) {
      throw new Error('No template was returned from the database');
    }
    
    return {
      id: savedTemplate.id,
      name: savedTemplate.name,
      description: savedTemplate.description,
      query: details.query,
      variables: details.variables,
      complexity: details.complexity,
      source_id: savedTemplate.source_id,
      created_at: savedTemplate.created_at,
      updated_at: savedTemplate.updated_at,
      execution_count: savedTemplate.execution_count || 0,
      average_execution_time: savedTemplate.average_execution_time || 0
    };
  } catch (error) {
    console.error("Error saving template:", error);
    return null;
  }
};

// Fetch query templates from Supabase
export const fetchTemplates = async (sourceId: string): Promise<QueryTemplate[]> => {
  try {
    const { data, error } = await supabase
      .from('shopify_query_templates')
      .select('*')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch templates: ${error.message}`);
    }
    
    return data.map((template) => {
      const details = template.details as QueryDetailsJson;
      return {
        id: template.id,
        name: template.name,
        description: template.description,
        query: details.query,
        variables: details.variables,
        complexity: details.complexity,
        source_id: template.source_id,
        created_at: template.created_at,
        updated_at: template.updated_at,
        execution_count: template.execution_count || 0,
        average_execution_time: template.average_execution_time || 0
      };
    });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return [];
  }
};

// Parse and load a query template
export const parseTemplateQuery = (
  template: QueryTemplate,
  setQueryName: (name: string) => void
): void => {
  setQueryName(template.name);
};
