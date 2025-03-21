
import { TypeField, QueryVariable } from "../types";
import { SchemaType } from "../types/schemaTypes";

export const getBaseType = (typeRef: any): any => {
  if (!typeRef.ofType) return typeRef;
  return getBaseType(typeRef.ofType);
};

export const getTypeName = (typeRef: any): string => {
  if (typeRef.kind === 'NON_NULL') {
    return `${getTypeName(typeRef.ofType)}!`;
  }
  if (typeRef.kind === 'LIST') {
    return `[${getTypeName(typeRef.ofType)}]`;
  }
  return typeRef.name || 'Unknown';
};

export const convertSchemaTypeToFields = (type: SchemaType): TypeField[] => {
  if (!type.fields) return [];
  
  return type.fields.map((field) => {
    const baseType = getBaseType(field.type);
    const isObjectType = baseType.kind === 'OBJECT' || baseType.kind === 'INTERFACE';
    
    return {
      name: field.name,
      type: getTypeName(field.type),
      description: field.description,
      args: field.args.map((arg) => ({
        name: arg.name,
        type: getTypeName(arg.type),
        description: arg.description,
        defaultValue: arg.defaultValue,
        value: ''
      })),
      selected: false,
      expanded: false,
      isDeprecated: field.isDeprecated,
      deprecationReason: field.deprecationReason,
      subfields: isObjectType ? [] : undefined
    };
  });
};
