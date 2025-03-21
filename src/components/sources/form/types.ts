
import { z } from 'zod';
import { ShopifyApiVersion, RateLimitInfo } from '@/integrations/supabase/client';

export const shopifySourceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  store_url: z.string().url("Please enter a valid URL").min(1, "Store URL is required"),
  api_key: z.string().min(1, "API key is required"),
  api_secret: z.string().min(1, "API secret is required"),
  access_token: z.string().min(1, "Access token is required"),
  api_version: z.enum(["2023-07", "2023-10", "2024-01", "2024-04"]),
  connection_timeout: z.string().min(1, "Connection timeout is required"),
  max_retries: z.string().min(1, "Max retries is required"),
  throttle_rate: z.string().min(1, "Throttle rate is required"),
  custom_headers: z.string().optional(),
});

export type SourceFormValues = z.infer<typeof shopifySourceSchema>;

export interface TestConnectionResult {
  success: boolean;
  message: string;
  rate_limits?: RateLimitInfo;
}
