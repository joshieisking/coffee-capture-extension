import type {
  DedupeCheckRequest,
  DedupeCheckResponse,
  EnrichWebsiteRequest,
  EnrichWebsiteResponse,
  ResolvePlaceRequest,
  ResolvePlaceResponse,
  SavePlaceRequest,
  SavePlaceResponse
} from "@coffee-capture/shared";

const API_BASE_URL = "http://localhost:54321/functions/v1";

async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

export function resolvePlace(payload: ResolvePlaceRequest): Promise<ResolvePlaceResponse> {
  return postJson("/resolve-place", payload);
}

export function dedupeCheck(payload: DedupeCheckRequest): Promise<DedupeCheckResponse> {
  return postJson("/dedupe-check", payload);
}

export function enrichWebsite(payload: EnrichWebsiteRequest): Promise<EnrichWebsiteResponse> {
  return postJson("/enrich-website", payload);
}

export function savePlace(payload: SavePlaceRequest): Promise<SavePlaceResponse> {
  return postJson("/save-place", payload);
}
