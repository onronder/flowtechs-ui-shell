
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";

// Initialize Supabase client
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL || "",
  import.meta.env.VITE_SUPABASE_ANON_KEY || ""
);

// Type definitions for our database tables
export type Source = {
  id: string;
  name: string;
  description: string | null;
  type: SourceType;
  user_id: string;
  store_name: string | null;
  api_version: string | null;
  connection_status: ConnectionStatus | null;
  connection_error: string | null;
  last_connected_at: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
};

export type Dataset = {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
  source_id: string;
  query_type: QueryType;
  query_name: string;
  query_details: Record<string, any> | null;
  data: any | null;
  status: string | null;
  record_count: number | null;
  data_updated_at: string | null;
  refresh_frequency: string | null;
  next_scheduled_run: string | null;
  created_at: string;
  updated_at: string;
  is_template: boolean | null;
  template_id: string | null;
  last_completed_run: string | null;
  last_run_duration: number | null;
  error_message: string | null;
  // New fields added to match our database schema
  extraction_progress: number | null;
  extraction_settings: {
    batch_size: number;
    max_retries: number;
    throttle_delay_ms: number;
    circuit_breaker_threshold: number;
    timeout_seconds: number;
  } | null;
  last_error_details: Record<string, any> | null;
};

export type ExtractionLog = {
  id: string;
  dataset_id: string;
  start_time: string;
  end_time: string | null;
  status: string;
  records_processed: number | null;
  total_records: number | null;
  error_message: string | null;
  api_calls: number | null;
  average_response_time: number | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
};

export type DatasetTemplate = {
  id: string;
  name: string;
  description: string | null;
  query_type: QueryType;
  query_name: string;
  query_details: Record<string, any> | null;
  created_at: string;
  updated_at: string;
};

// Enum types
export type SourceType = "shopify" | "amazon" | "ebay" | "etsy" | "woocommerce";
export type ConnectionStatus = "connected" | "disconnected" | "error";
export type QueryType = "product" | "order" | "customer" | "inventory" | "collection" | "custom";
