import { BREW_METHODS, type BrewMethod, type NormalizedPlaceRecord, type PlaceDraft } from "./place";

const REQUIRED_FIELDS: Array<keyof Pick<PlaceDraft, "name" | "address" | "google_maps_url">> = [
  "name",
  "address",
  "google_maps_url"
];

export function isBrewMethod(value: string): value is BrewMethod {
  return BREW_METHODS.includes(value as BrewMethod);
}

export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function sanitizeDraft(draft: PlaceDraft): PlaceDraft {
  return {
    ...draft,
    name: draft.name.trim(),
    city: draft.city.trim(),
    country: draft.country.trim(),
    address: draft.address.trim(),
    notes: draft.notes.trim(),
    website: normalizeUrl(draft.website),
    instagram: normalizeUrl(draft.instagram),
    google_maps_url: draft.google_maps_url.trim(),
    roaster_partners: draft.roaster_partners.map((partner) => partner.trim()).filter(Boolean),
    source_url: draft.source_url.trim(),
    source_page: draft.source_page.trim(),
    source_name: draft.source_name.trim(),
    google_place_id: draft.google_place_id.trim(),
    source_hash: draft.source_hash.trim()
  };
}

export function validateDraft(draft: PlaceDraft): string[] {
  const errors: string[] = [];
  const sanitized = sanitizeDraft(draft);

  REQUIRED_FIELDS.forEach((field) => {
    if (!sanitized[field]) {
      errors.push(`${field} is required`);
    }
  });

  sanitized.brew_methods.forEach((method) => {
    if (!isBrewMethod(method)) {
      errors.push(`Unsupported brew method: ${method}`);
    }
  });

  if (sanitized.latitude !== null && Number.isNaN(sanitized.latitude)) {
    errors.push("latitude must be a number");
  }

  if (sanitized.longitude !== null && Number.isNaN(sanitized.longitude)) {
    errors.push("longitude must be a number");
  }

  const openingHoursEntries = Object.entries(sanitized.opening_hours ?? {});
  openingHoursEntries.forEach(([day, value]) => {
    if (!day.trim()) {
      errors.push("opening_hours keys cannot be blank");
    }
    if (typeof value !== "string") {
      errors.push(`opening_hours.${day} must be a string`);
    }
  });

  return errors;
}

export function toNormalizedPlaceRecord(draft: PlaceDraft): NormalizedPlaceRecord {
  return {
    ...sanitizeDraft(draft),
    approval: true
  };
}
