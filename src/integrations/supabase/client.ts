
import { createClient } from '@supabase/supabase-js';

// Default to empty string if environmental variables are not available
// This prevents the "supabaseUrl is required" error during development
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder_key';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Type definitions
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Shopify API versions
export type ShopifyApiVersion = '2023-10' | '2024-01' | '2024-04';

// Source types
export interface Source {
  id: string;
  name: string;
  description: string | null;
  type: 'shopify' | 'amazon' | 'ebay' | 'etsy' | 'woocommerce';
  store_name: string | null;
  access_token: string | null;
  api_version: string | null;
  connection_status: 'connected' | 'disconnected' | 'error' | null;
  connection_error: string | null;
  last_connected_at: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  client_id: string | null;
  rate_limit_rules: Record<string, any> | null;
}

// Dataset types
export type QueryType = 'product' | 'order' | 'customer' | 'inventory' | 'collection' | 'custom';

export interface Dataset {
  id: string;
  name: string;
  description: string | null;
  source_id: string;
  user_id: string;
  query_type: QueryType;
  query_name: string;
  query_details: Record<string, any> | null;
  data: any[] | null;
  status: string | null;
  record_count: number | null;
  data_updated_at: string | null;
  refresh_frequency: string | null;
  next_scheduled_run: string | null;
  last_completed_run: string | null;
  last_run_duration: number | null;
  last_error_details: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  template_id: string | null;
  is_template: boolean | null;
  extraction_progress: number | null;
  extraction_priority: number | null;
  extraction_settings: {
    batch_size?: number;
    max_retries?: number;
    throttle_delay_ms?: number;
    circuit_breaker_threshold?: number;
    timeout_seconds?: number;
    concurrent_requests?: number;
    deduplication_enabled?: boolean;
    cache_enabled?: boolean;
    field_optimization?: boolean;
  } | null;
  secure_query_validation: boolean | null;
  performance_metrics: Record<string, any> | null;
}

export interface DatasetTemplate {
  id: string;
  name: string;
  description: string | null;
  query_type: QueryType;
  query_name: string;
  query_details: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

// Rate limiting
export interface RateLimitInfo {
  available: number;
  maximum: number;
  restoreRate: number;
  requestCost: number;
  resetAt?: string;
}

// Helper functions
export function getMetadataValue<T>(metadata: Record<string, any> | null, key: string, defaultValue: T): T {
  if (!metadata) return defaultValue;
  return metadata[key] !== undefined ? metadata[key] : defaultValue;
}

export function extractIdFromGid(gid: string): string {
  if (!gid) return '';
  const parts = gid.split('/');
  if (parts.length < 4) return gid;
  return parts[parts.length - 1];
}

export function formatShopifyGid(type: string, id: string): string {
  if (id.includes('gid://')) return id;
  return `gid://shopify/${type}/${id}`;
}

// Convert database row to proper Dataset object
export function convertToDataset(data: any): Dataset {
  return {
    ...data,
    extraction_settings: data.extraction_settings ? {
      batch_size: data.extraction_settings.batch_size || 100,
      max_retries: data.extraction_settings.max_retries || 3,
      throttle_delay_ms: data.extraction_settings.throttle_delay_ms || 1000,
      circuit_breaker_threshold: data.extraction_settings.circuit_breaker_threshold || 5,
      timeout_seconds: data.extraction_settings.timeout_seconds || 30,
      concurrent_requests: data.extraction_settings.concurrent_requests || 2,
      deduplication_enabled: data.extraction_settings.deduplication_enabled !== false,
      cache_enabled: data.extraction_settings.cache_enabled !== false,
      field_optimization: data.extraction_settings.field_optimization !== false
    } : null,
    performance_metrics: data.performance_metrics || null
  };
}
