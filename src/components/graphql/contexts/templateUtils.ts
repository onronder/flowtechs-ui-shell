
import { supabase } from "@/integrations/supabase/client";
import { QueryTemplate, QueryVariable } from "../types";
import { toast as showToast } from "@/components/ui/use-toast";

export async function fetchTemplates(sourceId: string): Promise<QueryTemplate[]> {
  if (!sourceId) return [];
  
  try {
    const { data, error } = await supabase
      .from('dataset_templates')
      .select('*')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    if (!data) return [];
    
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
    
    return mappedTemplates;
  } catch (error) {
    console.error("Error fetching templates:", error);
    showToast({
      variant: "destructive",
      title: "Failed to load templates",
      description: "There was an error loading saved query templates."
    });
    return [];
  }
}

export async function saveTemplateToSupabase(
  templateData: {
    templateName: string;
    templateDescription: string;
  },
  generatedQuery: string,
  queryVariables: QueryVariable[],
  complexity: number,
  queryName: string,
  sourceId: string
): Promise<QueryTemplate | null> {
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
    
    const data = {
      name: templateData.templateName,
      description: templateData.templateDescription,
      query_type: "custom" as const,
      query_name: queryName,
      query_details: queryDetailsObject,
      source_id: sourceId
    };

    const { data: savedTemplate, error } = await supabase
      .from('dataset_templates')
      .insert(data)
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
    
    return mappedTemplate;
  } catch (error) {
    console.error("Error saving template:", error);
    return null;
  }
}

export function parseTemplateQuery(template: QueryTemplate, setQueryName: (name: string) => void): void {
  try {
    const lines = template.query.split('\n');
    const queryNameLine = lines[0];
    const queryNameMatch = queryNameLine.match(/query\s+([a-zA-Z0-9_]+)/);
    
    if (queryNameMatch && queryNameMatch[1]) {
      setQueryName(queryNameMatch[1]);
    }
  } catch (error) {
    console.error("Error parsing template query:", error);
  }
}
