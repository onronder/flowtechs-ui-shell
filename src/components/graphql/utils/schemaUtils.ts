
import { SchemaTypeRef, SchemaType } from "../types/schemaTypes";

export const getTypeFromRef = (typeRef: SchemaTypeRef): { kind: string, name: string } => {
  if (typeRef.kind !== 'NON_NULL' && typeRef.kind !== 'LIST' && typeRef.name) {
    return { kind: typeRef.kind, name: typeRef.name };
  }
  if (typeRef.ofType) {
    return getTypeFromRef(typeRef.ofType);
  }
  return { kind: 'UNKNOWN', name: 'Unknown' };
};

export const getTypeName = (typeRef: SchemaTypeRef): string => {
  if (typeRef.kind === 'NON_NULL') {
    return `${getTypeName(typeRef.ofType!)}!`;
  }
  if (typeRef.kind === 'LIST') {
    return `[${getTypeName(typeRef.ofType!)}]`;
  }
  return typeRef.name || 'Unknown';
};

export const filterTypes = (types: SchemaType[], searchQuery: string, visibleTypes: string[], showDeprecated: boolean) => {
  if (!types) return [];
  
  return types
    .filter(type => 
      !type.name.startsWith('__') && 
      visibleTypes.includes(type.name) &&
      (showDeprecated || !type.name.includes('Deprecated')) &&
      (searchQuery === '' || 
        type.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        type.description?.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => a.name.localeCompare(b.name));
};
