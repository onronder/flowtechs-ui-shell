
import { createClient } from '@supabase/supabase-js';

// Default to empty string if environmental variables are not available
// This prevents the "supabaseUrl is required" error during development
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder_key';

export const supabase = createClient(supabaseUrl, supabaseKey);
