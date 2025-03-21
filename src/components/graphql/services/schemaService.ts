
import { supabase } from "@/integrations/supabase/client";
import { TypeField } from "../types";
import { getTypeName } from "../utils/fieldsTreeUtils";

export const loadSubfields = async (field: TypeField, sourceId: string): Promise<TypeField[]> => {
  if (!sourceId) {
    throw new Error("Source ID is required to load schema");
  }
  
  // Get the base type name (remove array brackets and non-null indicators)
  const baseTypeName = field.type.replace(/[\[\]!]/g, '');
  
  if (!baseTypeName) {
    throw new Error("Invalid type name");
  }
  
  try {
    // Find the type in the schema
    const response = await supabase.functions.invoke('introspect-shopify-schema', {
      body: { sourceId }
    });
    
    if (response.error) {
      throw new Error(`API Error: ${response.error.message}`);
    }
    
    if (!response.data || !response.data.success) {
      throw new Error(response.data?.error || 'Failed to load schema: No data returned');
    }
    
    const schema = response.data.schema;
    
    if (!schema || !schema.__schema || !schema.__schema.types) {
      throw new Error('Invalid schema structure: Schema types not found');
    }
    
    const subType = schema.__schema.types.find((t: any) => t.name === baseTypeName);
    
    if (!subType) {
      throw new Error(`Type "${baseTypeName}" not found in schema`);
    }
    
    if (!subType.fields) {
      return [];
    }
    
    // Convert fields to our format
    return subType.fields.map((subfield: any) => {
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
        args: Array.isArray(subfield.args) ? subfield.args.map((arg: any) => ({
          name: arg.name,
          type: getTypeName(arg.type),
          description: arg.description,
          defaultValue: arg.defaultValue,
          value: ''
        })) : [],
        selected: false,
        expanded: false,
        isDeprecated: subfield.isDeprecated || false,
        deprecationReason: subfield.deprecationReason || null,
        subfields: isObjectType ? [] : undefined
      };
    });
  } catch (error) {
    console.error(`Error loading subfields for ${field.name}:`, error);
    throw error instanceof Error 
      ? error 
      : new Error(`Failed to load subfields for ${field.name}`);
  }
};

// Add a new function to directly fetch the latest Shopify API schema version
export const getLatestShopifyApiVersion = async (): Promise<string> => {
  try {
    // This could be enhanced to actually fetch from Shopify's version endpoint
    // For now we'll return the latest known version
    return '2024-04';
  } catch (error) {
    console.error('Error fetching latest Shopify API version:', error);
    // Default to a known recent version if the fetch fails
    return '2024-04';
  }
};

// Add a new function to check if we have a cached schema
export const getShopifySchemaFromCache = async (sourceId: string): Promise<any> => {
  try {
    const { data, error } = await supabase
      .from('api_schemas')
      .select('*')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      throw error;
    }
    
    if (data && data.schema && new Date(data.cache_valid_until) > new Date()) {
      console.log('Using cached schema, valid until:', data.cache_valid_until);
      return {
        schema: data.schema,
        apiVersion: data.api_version,
        fromCache: true
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error checking schema cache:', error);
    return null;
  }
};
