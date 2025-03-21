
import { supabase } from "@/integrations/supabase/client";
import { QueryVariable, QueryResult } from "../types";
import { toast as showToast } from "@/components/ui/use-toast";

export async function executeQueryOnSupabase(
  sourceId: string,
  generatedQuery: string,
  queryVariables: QueryVariable[]
): Promise<{ result: QueryResult | null; error: string | null; executionTime: number }> {
  if (!sourceId || !generatedQuery) {
    return { result: null, error: "Invalid query parameters", executionTime: 0 };
  }
  
  const startTime = performance.now();
  
  try {
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
    const executionTime = endTime - startTime;
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    if (!response.data.success) {
      throw new Error(response.data.error || 'Query execution failed');
    }
    
    return { 
      result: response.data, 
      error: null, 
      executionTime 
    };
  } catch (error) {
    console.error("Error executing query:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    const endTime = performance.now();
    return { 
      result: null, 
      error: errorMessage, 
      executionTime: endTime - startTime 
    };
  }
}
