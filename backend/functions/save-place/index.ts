import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { badRequest, buildSourceHash, jsonResponse, readJson, validateSavePlaceRecord } from "../_shared/utils.ts";
import type { NormalizedPlaceRecord } from "../_shared/types.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const payload = await readJson<{ record?: NormalizedPlaceRecord }>(request);
  const errors = validateSavePlaceRecord(payload);
  if (errors.length > 0) {
    return badRequest(errors.join(", "));
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required." }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const incomingRecord = payload.record!;
  const record = {
    ...incomingRecord,
    source_hash: incomingRecord.source_hash || buildSourceHash(incomingRecord),
    updated_at: new Date().toISOString()
  };

  let existingQuery = supabase
    .from("places")
    .select("id")
    .eq("google_maps_url", incomingRecord.google_maps_url)
    .limit(1);

  if (incomingRecord.google_place_id) {
    existingQuery = supabase
      .from("places")
      .select("id")
      .eq("google_place_id", incomingRecord.google_place_id)
      .limit(1);
  }

  const existingResult = await existingQuery.maybeSingle();
  if (existingResult.error) {
    return jsonResponse({ error: existingResult.error.message }, 500);
  }

  let data;
  let error;
  let status: "created" | "updated" = "created";

  if (existingResult.data?.id) {
    status = "updated";
    const updateResult = await supabase
      .from("places")
      .update(record)
      .eq("id", existingResult.data.id)
      .select("*")
      .single();
    data = updateResult.data;
    error = updateResult.error;
  } else {
    const insertResult = await supabase
      .from("places")
      .insert(record)
      .select("*")
      .single();
    data = insertResult.data;
    error = insertResult.error;
  }

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({
    status,
    id: data.id,
    record: data
  });
});
