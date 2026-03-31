import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { badRequest, buildSourceHash, isAuthorizedRequest, jsonResponse, readJson, unauthorized, validateSavePlaceRecord } from "../_shared/utils.ts";
import type { NormalizedPlaceRecord } from "../_shared/types.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseSecretKey =
  Deno.env.get("COFFEE_CAPTURE_SUPABASE_SECRET_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";

function toCoffeeShopsRow(record: NormalizedPlaceRecord) {
  return {
    name: record.name,
    city: record.city,
    country: record.country,
    address: record.address,
    notes: record.notes,
    website: record.website,
    instagram: record.instagram,
    google_maps_url: record.google_maps_url,
    brew_methods: record.brew_methods,
    roaster_partners: record.roaster_partners,
    roasts_in_house: record.roasts_in_house,
    confidence_score: record.confidence_score,
    source_url: record.source_url,
    source_page: record.source_page,
    source_name: record.source_name,
    source_year: record.source_year,
    latitude: record.latitude,
    longitude: record.longitude,
    opening_hours: record.opening_hours,
    rank: null
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!isAuthorizedRequest(request)) {
    return unauthorized();
  }

  const payload = await readJson<{ record?: NormalizedPlaceRecord }>(request);
  const errors = validateSavePlaceRecord(payload);
  if (errors.length > 0) {
    return badRequest(errors.join(", "));
  }

  if (!supabaseUrl || !supabaseSecretKey) {
    return jsonResponse({ error: "SUPABASE_URL and COFFEE_CAPTURE_SUPABASE_SECRET_KEY are required." }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey);
  const incomingRecord = payload.record!;
  const record = toCoffeeShopsRow({
    ...incomingRecord,
    source_hash: incomingRecord.source_hash || buildSourceHash(incomingRecord)
  });

  let existingQuery = supabase
    .from("coffee_shops")
    .select("id")
    .eq("google_maps_url", incomingRecord.google_maps_url)
    .limit(1);

  if (incomingRecord.name && incomingRecord.country) {
    existingQuery = supabase
      .from("coffee_shops")
      .select("id")
      .eq("name", incomingRecord.name)
      .eq("country", incomingRecord.country)
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
      .from("coffee_shops")
      .update(record)
      .eq("id", existingResult.data.id)
      .select("*")
      .single();
    data = updateResult.data;
    error = updateResult.error;
  } else {
    const insertResult = await supabase
      .from("coffee_shops")
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
