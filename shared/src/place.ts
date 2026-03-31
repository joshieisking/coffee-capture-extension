export const BREW_METHODS = [
  "espresso",
  "pour_over",
  "batch_brew",
  "aeropress",
  "syphon",
  "cold_brew",
  "french_press",
  "filter"
] as const;

export type BrewMethod = (typeof BREW_METHODS)[number];

export type FieldConfidence = "high" | "medium" | "low" | "unknown";

export interface DraftFieldMeta {
  confidence: FieldConfidence;
  source: "maps_dom" | "maps_url" | "manual" | "backend" | "unknown";
  note?: string;
}

export interface PlaceDraft {
  name: string;
  city: string;
  country: string;
  address: string;
  notes: string;
  website: string;
  instagram: string;
  google_maps_url: string;
  brew_methods: BrewMethod[];
  roaster_partners: string[];
  roasts_in_house: boolean | null;
  confidence_score: number | null;
  source_url: string;
  source_page: string;
  source_name: string;
  source_year: number | null;
  latitude: number | null;
  longitude: number | null;
  opening_hours: Record<string, string>;
  google_place_id: string;
  source_hash: string;
  field_meta: Partial<Record<keyof Omit<PlaceDraft, "field_meta">, DraftFieldMeta>>;
}

export interface NormalizedPlaceRecord extends Omit<PlaceDraft, "field_meta"> {
  approval: true;
}

export interface ResolvePlaceRequest {
  name: string;
  address: string;
  google_maps_url: string;
  latitude: number | null;
  longitude: number | null;
}

export interface ResolvePlaceResponse {
  status: "ok";
  data: {
    place_id: string;
    canonical_name: string;
    canonical_address: string;
    canonical_coordinates: {
      latitude: number | null;
      longitude: number | null;
    };
  } | null;
  confidence: number;
  warnings: string[];
}

export interface DedupeCheckRequest {
  google_maps_url: string;
  place_id: string;
  normalized_name: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

export interface DuplicateMatch {
  id: string;
  name: string;
  google_place_id: string | null;
  google_maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface DedupeCheckResponse {
  status: "ok";
  duplicate: boolean;
  match: DuplicateMatch | null;
  confidence: number;
  warnings: string[];
}

export interface EnrichWebsiteRequest {
  website: string;
  name?: string;
  place_id?: string;
}

export interface EnrichWebsiteResponse {
  status: "ok";
  data: {
    instagram: string;
    roasts_in_house: boolean | null;
    brew_methods: BrewMethod[];
    roaster_partners: string[];
    metadata: {
      title: string;
      description: string;
    };
    evidence: string[];
  };
  confidence: number;
  warnings: string[];
}

export interface SavePlaceRequest {
  record: NormalizedPlaceRecord;
}

export interface SavePlaceResponse {
  status: "created" | "updated";
  id: string;
  record: Record<string, unknown>;
}

export function createEmptyDraft(): PlaceDraft {
  return {
    name: "",
    city: "",
    country: "",
    address: "",
    notes: "",
    website: "",
    instagram: "",
    google_maps_url: "",
    brew_methods: [],
    roaster_partners: [],
    roasts_in_house: null,
    confidence_score: null,
    source_url: "",
    source_page: "Google Maps",
    source_name: "Google Maps Capture",
    source_year: null,
    latitude: null,
    longitude: null,
    opening_hours: {},
    google_place_id: "",
    source_hash: "",
    field_meta: {}
  };
}
