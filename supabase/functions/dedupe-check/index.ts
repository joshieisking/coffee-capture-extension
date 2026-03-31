import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { badRequest, distanceScore, isAuthorizedRequest, jaccardSimilarity, jsonResponse, normalizeComparisonText, readJson, unauthorized, validateDedupeRequest } from "../_shared/utils.ts";
import type { DedupeCheckRequest } from "../_shared/types.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseSecretKey =
  Deno.env.get("COFFEE_CAPTURE_SUPABASE_SECRET_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";

interface CandidateRow {
  id: string;
  name: string;
  google_maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
  country: string | null;
  city: string | null;
}

function scoreCandidate(payload: DedupeCheckRequest, candidate: CandidateRow): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (
    payload.google_maps_url?.trim() &&
    candidate.google_maps_url?.trim() &&
    payload.google_maps_url.trim() === candidate.google_maps_url.trim()
  ) {
    return { score: 1, reasons: ["exact Google Maps URL match"] };
  }

  const payloadName = normalizeComparisonText(payload.normalized_name);
  const candidateName = normalizeComparisonText(candidate.name ?? "");

  if (payloadName && candidateName) {
    if (payloadName === candidateName) {
      score += 0.68;
      reasons.push("normalized name match");
    } else {
      const similarity = jaccardSimilarity(payload.normalized_name, candidate.name);
      if (similarity >= 0.8) {
        score += 0.5;
        reasons.push("high name similarity");
      } else if (similarity >= 0.6) {
        score += 0.3;
        reasons.push("moderate name similarity");
      }
    }
  }

  if (
    payload.country?.trim() &&
    candidate.country?.trim() &&
    normalizeComparisonText(payload.country) === normalizeComparisonText(candidate.country)
  ) {
    score += 0.15;
    reasons.push("country match");
  }

  if (
    payload.city?.trim() &&
    candidate.city?.trim() &&
    normalizeComparisonText(payload.city) === normalizeComparisonText(candidate.city)
  ) {
    score += 0.12;
    reasons.push("city match");
  }

  const geoScore = distanceScore(payload.latitude, payload.longitude, candidate.latitude, candidate.longitude);
  if (geoScore > 0) {
    score += geoScore;
    reasons.push(geoScore >= 0.25 ? "nearby coordinates" : "rough coordinate match");
  }

  return { score, reasons };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!isAuthorizedRequest(request)) {
    return unauthorized();
  }

  const payload = await readJson<DedupeCheckRequest>(request);
  const errors = validateDedupeRequest(payload);
  if (errors.length > 0) {
    return badRequest(errors.join(", "));
  }

  if (!supabaseUrl || !supabaseSecretKey) {
    return jsonResponse({
      status: "ok",
      duplicate: false,
      match: null,
      confidence: 0,
      warnings: ["Supabase environment variables are missing; dedupe is running in noop mode."]
    });
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey);
  const query = supabase
    .from("coffee_shops")
    .select("id, name, google_maps_url, latitude, longitude, country, city")
    .limit(200);

  const { data, error } = await query;
  if (error) {
    return jsonResponse({
      status: "ok",
      duplicate: false,
      match: null,
      confidence: 0,
      warnings: [error.message]
    });
  }

  const candidates = (data ?? []) as CandidateRow[];
  let bestMatch: CandidateRow | null = null;
  let bestScore = 0;
  let bestReasons: string[] = [];

  for (const candidate of candidates) {
    const { score, reasons } = scoreCandidate(payload, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
      bestReasons = reasons;
    }
  }

  const duplicate = bestScore >= 0.72;

  return jsonResponse({
    status: "ok",
    duplicate,
    match: duplicate ? bestMatch : null,
    confidence: Number(bestScore.toFixed(2)),
    warnings: duplicate ? [`Duplicate matched by ${bestReasons.join(", ")}.`] : []
  });
});
