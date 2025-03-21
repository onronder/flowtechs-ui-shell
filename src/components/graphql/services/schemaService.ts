
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
