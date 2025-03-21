
import { supabase } from "@/integrations/supabase/client";
import { TypeField } from "../types";
import { getTypeName } from "../utils/fieldsTreeUtils";

export const loadSubfields = async (field: TypeField, sourceId: string): Promise<TypeField[]> => {
  // Get the base type name (remove array brackets and non-null indicators)
  const baseTypeName = field.type.replace(/[\[\]!]/g, '');
  
  // Find the type in the schema
  const response = await supabase.functions.invoke('introspect-shopify-schema', {
    body: { sourceId }
  });
  
  if (response.error || !response.data.success) {
    throw new Error(response.error?.message || response.data.error || 'Failed to load schema');
  }
  
  const schema = response.data.schema;
  const subType = schema.__schema.types.find((t: any) => t.name === baseTypeName);
  
  if (!subType || !subType.fields) {
    throw new Error(`Type ${baseTypeName} not found in schema or has no fields`);
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
      args: subfield.args.map((arg: any) => ({
        name: arg.name,
        type: getTypeName(arg.type),
        description: arg.description,
        defaultValue: arg.defaultValue,
        value: ''
      })),
      selected: false,
      expanded: false,
      isDeprecated: subfield.isDeprecated,
      deprecationReason: subfield.deprecationReason,
      subfields: isObjectType ? [] : undefined
    };
  });
};
