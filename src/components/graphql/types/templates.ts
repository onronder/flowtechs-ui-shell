
import { QueryVariable } from './core';

export interface QueryTemplate {
  id: string;
  name: string;
  description: string | null;
  query: string;
  variables: QueryVariable[];
  complexity: number;
  source_id: string; // Changed from source_id to match the usage in our code
  created_at: string;
  updated_at: string;
  execution_count?: number;
  average_execution_time?: number;
}

// Define the JSON type helper for query details
export interface QueryDetailsJson {
  query: string;
  variables: Array<{
    name: string;
    type: string;
    defaultValue: string;
  }>;
  complexity: number;
  execution_count?: number;
  average_execution_time?: number;
}
