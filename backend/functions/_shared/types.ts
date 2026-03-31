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

export interface NormalizedPlaceRecord {
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
  approval: true;
}

export interface ResolvePlaceRequest {
  name: string;
  address: string;
  google_maps_url: string;
  latitude: number | null;
  longitude: number | null;
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

export interface EnrichWebsiteRequest {
  website: string;
  name?: string;
  place_id?: string;
}
