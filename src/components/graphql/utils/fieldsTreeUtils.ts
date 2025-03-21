
import { TypeField, FieldArgument } from "../types";

// Updates the expanded state of a field in the tree
export const updateExpandedState = (fields: TypeField[], path: string[], expanded: boolean): TypeField[] => {
  return fields.map(field => {
    if (field.name === path[0]) {
      if (path.length === 1) {
        return { ...field, expanded };
      } else if (field.subfields) {
        return {
          ...field,
          subfields: updateExpandedState(field.subfields, path.slice(1), expanded)
        };
      }
    }
    return field;
  });
};

// Updates the subfields of a field in the tree
export const updateSubfields = (fields: TypeField[], path: string[], subfields: TypeField[]): TypeField[] => {
  return fields.map(field => {
    if (field.name === path[0]) {
      if (path.length === 1) {
        return { ...field, subfields, expanded: true };
      } else if (field.subfields) {
        return {
          ...field,
          subfields: updateSubfields(field.subfields, path.slice(1), subfields)
        };
      }
    }
    return field;
  });
};

// Updates the selection state of a field in the tree
export const updateFieldSelection = (fields: TypeField[], path: string[], selected: boolean): TypeField[] => {
  return fields.map(field => {
    if (field.name === path[0]) {
      if (path.length === 1) {
        return { ...field, selected };
      } else if (field.subfields) {
        return {
          ...field,
          subfields: updateFieldSelection(field.subfields, path.slice(1), selected)
        };
      }
    }
    return field;
  });
};

// Updates an argument value for a field in the tree
export const updateArgumentValue = (fields: TypeField[], path: string[], argName: string, value: string): TypeField[] => {
  return fields.map(field => {
    if (field.name === path[0]) {
      if (path.length === 1) {
        return {
          ...field,
          args: field.args.map(arg => 
            arg.name === argName ? { ...arg, value } : arg
          )
        };
      } else if (field.subfields) {
        return {
          ...field,
          subfields: updateArgumentValue(field.subfields, path.slice(1), argName, value)
        };
      }
    }
    return field;
  });
};

// Function to convert a type reference to a string
export const getTypeName = (typeRef: any): string => {
  if (typeRef.kind === 'NON_NULL') {
    return `${getTypeName(typeRef.ofType)}!`;
  }
  if (typeRef.kind === 'LIST') {
    return `[${getTypeName(typeRef.ofType)}]`;
  }
  return typeRef.name || 'Unknown';
};
