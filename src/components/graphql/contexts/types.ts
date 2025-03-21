
import { SchemaType, SchemaField } from "../types/schemaTypes";
import { TypeField, QueryVariable, QueryTemplate, QueryResult } from "../types";

// Define a simpler SelectedFieldsType to avoid excessive type recursion
export type SelectedFieldsType = Record<string, Set<string>>;

export type QueryBuilderContextType = {
  sourceId: string;
  selectedType: SchemaType | null;
  setSelectedType: (type: SchemaType | null) => void;
  fields: TypeField[];
  setFields: (fields: TypeField[]) => void;
  generatedQuery: string;
  queryVariables: QueryVariable[];
  selectedFields: SelectedFieldsType;
  setSelectedFields: (fields: SelectedFieldsType) => void;
  queryName: string;
  setQueryName: (name: string) => void;
  complexity: number;
  templates: QueryTemplate[];
  queryResult: QueryResult | null;
  isExecuting: boolean;
  executionTime: number | null;
  errorMessage: string | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  saveDialogOpen: boolean;
  setSaveDialogOpen: (open: boolean) => void;
  handleTypeSelect: (type: SchemaType) => void;
  handleFieldSelect: (schemaField: SchemaField, parentType: SchemaType) => void;
  handleVariableChange: (index: number, field: keyof QueryVariable, value: string) => void;
  saveTemplate: (data: any) => Promise<void>;
  loadTemplate: (template: QueryTemplate) => void;
  executeQuery: () => Promise<void>;
  copyToClipboard: (text: string) => void;
};
