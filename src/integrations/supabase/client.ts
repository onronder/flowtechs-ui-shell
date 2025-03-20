
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
    concurrent_requests: number;
    deduplication_enabled: boolean;
    cache_enabled: boolean;
    field_optimization: boolean;
  } | null;
  last_error_details: Record<string, any> | null;
  performance_metrics: {
    records_per_second: number;
    api_calls_per_record: number;
    average_response_time: number;
    quota_usage_percentage: number;
  } | null;
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
export type ShopifyApiVersion = "2023-07" | "2023-10" | "2024-01" | "2024-04";

// Utility types
export type RateLimitInfo = {
  available: number;
  maximum: number;
  restoreRate: number;
  requestCost: number;
};

// Utility functions for metadata handling
export const getMetadataValue = <T>(
  metadata: Record<string, any> | null,
  key: string,
  defaultValue: T
): T => {
  if (!metadata) return defaultValue;
  return (metadata[key] as T) || defaultValue;
};

// Shopify GraphQL ID parsing utilities
export const parseShopifyGid = (gid: string): { type: string; id: string } => {
  // Format: gid://shopify/{resource_type}/{resource_id}
  try {
    const parts = gid.split('/');
    if (parts.length < 4) {
      throw new Error(`Invalid Shopify GID format: ${gid}`);
    }
    
    return {
      type: parts[parts.length - 2].toLowerCase(),
      id: parts[parts.length - 1]
    };
  } catch (error) {
    console.error(`Failed to parse Shopify GID: ${gid}`, error);
    return { type: 'unknown', id: gid };
  }
};

// Extract numeric ID from Shopify GID
export const extractIdFromGid = (gid: string): string => {
  return parseShopifyGid(gid).id;
};

// Format to Shopify GID
export const formatShopifyGid = (type: string, id: string): string => {
  return `gid://shopify/${type}/${id}`;
};
