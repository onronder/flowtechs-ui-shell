
export interface SchemaType {
  kind: string;
  name: string;
  description: string | null;
  fields: SchemaField[] | null;
  inputFields: SchemaInputValue[] | null;
  interfaces: SchemaTypeRef[] | null;
  enumValues: SchemaEnumValue[] | null;
  possibleTypes: SchemaTypeRef[] | null;
}

export interface SchemaField {
  name: string;
  description: string | null;
  args: SchemaInputValue[];
  type: SchemaTypeRef;
  isDeprecated: boolean;
  deprecationReason: string | null;
}

export interface SchemaInputValue {
  name: string;
  description: string | null;
  type: SchemaTypeRef;
  defaultValue: string | null;
}

export interface SchemaTypeRef {
  kind: string;
  name: string | null;
  ofType: SchemaTypeRef | null;
}

export interface SchemaEnumValue {
  name: string;
  description: string | null;
  isDeprecated: boolean;
  deprecationReason: string | null;
}

export interface SchemaExplorerProps {
  sourceId: string;
  onTypeSelect: (type: SchemaType) => void;
  onFieldSelect: (field: SchemaField, parentType: SchemaType) => void;
  selectedFields: Record<string, Set<string>>;
}
