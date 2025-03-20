
import { TypeField, QueryVariable } from "../types";

export const getTypeName = (typeRef: any): string => {
  if (typeRef.kind === 'NON_NULL') {
    return `${getTypeName(typeRef.ofType)}!`;
  }
  if (typeRef.kind === 'LIST') {
    return `[${getTypeName(typeRef.ofType)}]`;
  }
  return typeRef.name || 'Unknown';
};

export const convertSchemaTypeToFields = (type: any): TypeField[] => {
  if (!type.fields) return [];
  
  return type.fields.map((field: any) => {
    const baseType = getBaseType(field.type);
    const isObjectType = baseType.kind === 'OBJECT' || baseType.kind === 'INTERFACE';
    
    return {
      name: field.name,
      type: getTypeName(field.type),
      description: field.description,
      args: field.args.map((arg: any) => ({
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

export const getBaseType = (typeRef: any): any => {
  if (!typeRef.ofType) return typeRef;
  return getBaseType(typeRef.ofType);
};

export const generateGraphQLQuery = (
  fields: TypeField[],
  queryName: string
): { query: string; variables: QueryVariable[]; complexity: number } => {
  const variables: QueryVariable[] = [];
  let complexityScore = 0;
  
  const generateFieldString = (fields: TypeField[], indent = 2): string => {
    return fields
      .filter(field => field.selected)
      .map(field => {
        complexityScore += 1;
        
        // Handle field arguments
        const args = field.args
          .filter(arg => arg.value && arg.value.trim() !== '')
          .map(arg => {
            // Check if this is a variable
            if (arg.value?.startsWith('$')) {
              const varName = arg.value.substring(1);
              // Add to variables if not already there
              if (!variables.some(v => v.name === varName)) {
                variables.push({
                  name: varName,
                  type: arg.type,
                  defaultValue: ''
                });
              }
              return `${arg.name}: ${arg.value}`;
            }
            
            // Handle different value types
            let formattedValue = arg.value || '';
            if (arg.type.includes('Int') || arg.type.includes('Float')) {
              formattedValue = arg.value || '0';
            } else if (arg.type.includes('Boolean')) {
              formattedValue = arg.value === 'true' ? 'true' : 'false';
            } else {
              // It's a string or enum
              formattedValue = `"${arg.value}"`;
            }
            
            return `${arg.name}: ${formattedValue}`;
          })
          .join(', ');
          
        const argsString = args ? `(${args})` : '';
        
        // If field has subfields and they're selected
        if (field.subfields && field.subfields.some(sf => sf.selected)) {
          complexityScore += 2; // Additional complexity for nested fields
          const subfieldStr = generateFieldString(field.subfields, indent + 2);
          return `${' '.repeat(indent)}${field.name}${argsString} {\n${subfieldStr}\n${' '.repeat(indent)}}`;
        }
        
        return `${' '.repeat(indent)}${field.name}${argsString}`;
      })
      .join('\n');
  };
  
  let query = `query ${queryName}`;
  
  // Add variable declarations if needed
  if (variables.length > 0) {
    const variableDeclarations = variables
      .map(v => `$${v.name}: ${v.type}`)
      .join(', ');
    query += `(${variableDeclarations})`;
  }
  
  query += ` {\n`;
  query += generateFieldString(fields);
  query += `\n}`;
  
  return { query, variables, complexity: complexityScore };
};
