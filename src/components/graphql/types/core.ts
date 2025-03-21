
export interface TypeField {
  name: string;
  type: string;
  description: string | null;
  args: FieldArgument[];
  selected: boolean;
  subfields?: TypeField[];
  expanded?: boolean;
  isDeprecated?: boolean;
  deprecationReason?: string | null;
}

export interface FieldArgument {
  name: string;
  type: string;
  description: string | null;
  defaultValue: string | null;
  value?: string;
}

export interface QueryVariable {
  name: string;
  type: string;
  defaultValue: string;
}

// Type for selected fields (simpler to avoid deep recursion)
export type SelectedFieldsMapType = Record<string, Set<string>>;
