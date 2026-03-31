import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { badRequest, jsonResponse, readJson, validateDedupeRequest } from "../_shared/utils.ts";
import type { DedupeCheckRequest } from "../_shared/types.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const payload = await readJson<DedupeCheckRequest>(request);
  const errors = validateDedupeRequest(payload);
  if (errors.length > 0) {
    return badRequest(errors.join(", "));
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({
      status: "ok",
      duplicate: false,
      match: null,
      confidence: 0,
      warnings: ["Supabase environment variables are missing; dedupe is running in noop mode."]
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  let query = supabase
    .from("places")
    .select("id, name, google_place_id, google_maps_url, latitude, longitude")
    .limit(1);

  if (payload.place_id?.trim()) {
    query = query.eq("google_place_id", payload.place_id.trim());
  } else {
    query = query.eq("google_maps_url", payload.google_maps_url.trim());
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    return jsonResponse({
      status: "ok",
      duplicate: false,
      match: null,
      confidence: 0,
      warnings: [error.message]
    });
  }

  return jsonResponse({
    status: "ok",
    duplicate: Boolean(data),
    match: data,
    confidence: data ? 0.95 : 0.12,
    warnings: data ? ["Duplicate matched by place ID or Google Maps URL."] : []
  });
});
