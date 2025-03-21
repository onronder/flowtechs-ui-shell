
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProfileUpdateRequest {
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with Auth context of the user that called the function
    const supabaseClient = createClient(
      // Supabase API URL - env var exposed by default.
      Deno.env.get("SUPABASE_URL") ?? "",
      // Supabase API ANON KEY - env var exposed by default.
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: userError }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request based on method
    if (req.method === "GET") {
      // Fetch profile
      const { data, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        throw error;
      }

      return new Response(JSON.stringify({ profile: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (req.method === "PUT" || req.method === "POST") {
      // Update profile
      const input: ProfileUpdateRequest = await req.json();
      
      // Validate input
      const sanitizedInput: ProfileUpdateRequest = {};
      if (input.first_name !== undefined) sanitizedInput.first_name = input.first_name;
      if (input.last_name !== undefined) sanitizedInput.last_name = input.last_name;
      if (input.avatar_url !== undefined) sanitizedInput.avatar_url = input.avatar_url;

      // Update the profile
      const { data, error } = await supabaseClient
        .from("profiles")
        .update({ 
          ...sanitizedInput,
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id)
        .select()
        .single();

      if (error) {
        throw error;
      }
      
      // Update auth metadata as well
      await supabaseClient.auth.updateUser({
        data: {
          first_name: sanitizedInput.first_name,
          last_name: sanitizedInput.last_name,
        },
      });

      return new Response(JSON.stringify({ profile: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
