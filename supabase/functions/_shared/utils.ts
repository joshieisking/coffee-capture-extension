import type { DedupeCheckRequest, EnrichWebsiteRequest, NormalizedPlaceRecord, ResolvePlaceRequest } from "./types.ts";

export async function readJson<T>(request: Request): Promise<T> {
  return request.json() as Promise<T>;
}

export function isAuthorizedRequest(request: Request): boolean {
  const expectedApiKey =
    Deno.env.get("COFFEE_CAPTURE_SUPABASE_PUBLISHABLE_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
    "";

  if (!expectedApiKey) {
    return true;
  }

  const apiKey = request.headers.get("apikey") ?? "";
  return apiKey === expectedApiKey;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
    }
  });
}

export function badRequest(message: string): Response {
  return jsonResponse({ error: message }, 400);
}

export function unauthorized(): Response {
  return jsonResponse({ error: "Unauthorized" }, 401);
}

export function validateResolvePlaceRequest(payload: ResolvePlaceRequest): string[] {
  const errors: string[] = [];
  if (!payload.name?.trim()) {
    errors.push("name is required");
  }
  if (!payload.address?.trim()) {
    errors.push("address is required");
  }
  if (!payload.google_maps_url?.trim()) {
    errors.push("google_maps_url is required");
  }
  return errors;
}

export function validateDedupeRequest(payload: DedupeCheckRequest): string[] {
  const errors: string[] = [];
  if (!payload.google_maps_url?.trim() && !payload.place_id?.trim()) {
    errors.push("google_maps_url or place_id is required");
  }
  if (!payload.normalized_name?.trim()) {
    errors.push("normalized_name is required");
  }
  return errors;
}

export function validateEnrichWebsiteRequest(payload: EnrichWebsiteRequest): string[] {
  const errors: string[] = [];
  if (!payload.website?.trim()) {
    errors.push("website is required");
  }
  return errors;
}

export function validateSavePlaceRecord(payload: { record?: NormalizedPlaceRecord }): string[] {
  const errors: string[] = [];
  const record = payload.record;

  if (!record) {
    return ["record is required"];
  }

  if (record.approval !== true) {
    errors.push("approval must be true");
  }
  if (!record.name?.trim()) {
    errors.push("name is required");
  }
  if (!record.address?.trim()) {
    errors.push("address is required");
  }
  if (!record.google_maps_url?.trim()) {
    errors.push("google_maps_url is required");
  }

  return errors;
}

export function buildSourceHash(input: Pick<NormalizedPlaceRecord, "name" | "address" | "google_maps_url">): string {
  const source = `${input.name.trim().toLowerCase()}|${input.address.trim().toLowerCase()}|${input.google_maps_url.trim()}`;
  return crypto.randomUUID().replace(/-.+$/, "") + "-" + source.length.toString(16);
}

export function deriveResolveResult(payload: ResolvePlaceRequest) {
  const normalizedName = payload.name.trim();
  const canonicalName = normalizedName.replace(/\s+/g, " ");
  const placeId = payload.google_maps_url
    ? `maps_${btoa(payload.google_maps_url).replace(/=+$/g, "").slice(0, 24)}`
    : "";

  return {
    status: "ok",
    data: canonicalName
      ? {
          place_id: placeId,
          canonical_name: canonicalName,
          canonical_address: payload.address.trim(),
          canonical_coordinates: {
            latitude: payload.latitude,
            longitude: payload.longitude
          }
        }
      : null,
    confidence: canonicalName ? 0.72 : 0,
    warnings: canonicalName ? ["Using heuristic Phase 1 resolver until Google Places is wired."] : ["No candidate found."]
  };
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractMetaContent(html: string, name: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["'][^>]*>`, "i")
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
}

export function normalizeComparisonText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value: string): string[] {
  return normalizeComparisonText(value)
    .split(" ")
    .filter(Boolean)
    .filter((token) => !["the", "and"].includes(token));
}

export function jaccardSimilarity(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let intersection = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  });

  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

export function distanceScore(
  leftLat: number | null,
  leftLng: number | null,
  rightLat: number | null,
  rightLng: number | null
): number {
  if (
    leftLat === null ||
    leftLng === null ||
    rightLat === null ||
    rightLng === null
  ) {
    return 0;
  }

  const deltaLat = leftLat - rightLat;
  const deltaLng = leftLng - rightLng;
  const distance = Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng);

  if (distance <= 0.0015) {
    return 0.25;
  }

  if (distance <= 0.005) {
    return 0.12;
  }

  return 0;
}
