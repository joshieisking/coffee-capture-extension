import { createEmptyDraft, type DraftFieldMeta, type PlaceDraft } from "@coffee-capture/shared";

const DAY_NAMES = new Set([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
]);

const DAY_ALIASES: Record<string, string[]> = {
  monday: ["Monday", "Mon", "月曜日"],
  tuesday: ["Tuesday", "Tue", "火曜日"],
  wednesday: ["Wednesday", "Wed", "水曜日"],
  thursday: ["Thursday", "Thu", "木曜日"],
  friday: ["Friday", "Fri", "金曜日"],
  saturday: ["Saturday", "Sat", "土曜日"],
  sunday: ["Sunday", "Sun", "日曜日"]
};

function setMeta(
  draft: PlaceDraft,
  field: keyof Omit<PlaceDraft, "field_meta">,
  meta: DraftFieldMeta
): void {
  draft.field_meta[field] = meta;
}

function getText(selectors: string[]): string {
  for (const selector of selectors) {
    const element = document.querySelector<HTMLElement>(selector);
    const value = element?.innerText?.trim() || element?.textContent?.trim();
    if (value) {
      return value;
    }
  }
  return "";
}

function getButtonText(itemId: string): string {
  const selector = `button[data-item-id='${itemId}'], a[data-item-id='${itemId}']`;
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector));

  for (const candidate of candidates) {
    const value = candidate.innerText?.trim() || candidate.textContent?.trim() || candidate.getAttribute("aria-label")?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function getWebsiteUrl(): string {
  const websiteLink = Array.from(document.querySelectorAll<HTMLAnchorElement>("a"))
    .find((anchor) => {
      if (!anchor.href || !/https?:\/\//.test(anchor.href)) {
        return false;
      }

      return anchor.dataset?.itemId === "authority" || anchor.getAttribute("data-tooltip") === "Open website";
    });
  return websiteLink?.href ?? "";
}

function getPageText(): string {
  return document.body.innerText || document.body.textContent || "";
}

function normalizeAddressSegment(segment: string): string {
  return segment.replace(/\s+/g, " ").replace(/^〒\d{3}-\d{4}\s*/, "").trim();
}

function extractPlusCodeLocation(pageText: string): string {
  const match = pageText.match(/[A-Z0-9]{4}\+[A-Z0-9]{2}\s+([^\n]+)/);
  return match?.[1]?.trim() ?? "";
}

function detectLocale(address: string, plusCodeLocation: string): "singapore" | "japan" | "unknown" {
  const combined = `${address} ${plusCodeLocation}`;
  if (/\bSingapore\b/i.test(combined)) {
    return "singapore";
  }

  if (/\bJapan\b|〒\d{3}-\d{4}|Tokyo|Osaka|Kyoto|Shibuya|Shinjuku|Toshima|区|市|町|村/i.test(combined)) {
    return "japan";
  }

  return "unknown";
}

function parseSingaporeAddress(address: string): { city: string; country: string } {
  if (/\bSingapore\b/i.test(address)) {
    return {
      city: "Singapore",
      country: "Singapore"
    };
  }

  return {
    city: "",
    country: ""
  };
}

function parseJapanAddress(address: string, plusCodeLocation: string): { city: string; country: string } {
  const segments = address
    .split(",")
    .map(normalizeAddressSegment)
    .filter(Boolean);

  const plusCodeSegments = plusCodeLocation
    .split(",")
    .map(normalizeAddressSegment)
    .filter(Boolean);

  const cityPattern = /(?:City|Ward|Ku)\b|[^\s,]+[区市町村]/i;
  const cityFromPlusCode = plusCodeSegments.find((segment) => cityPattern.test(segment));
  if (cityFromPlusCode) {
    return {
      city: cityFromPlusCode,
      country: "Japan"
    };
  }

  const cityFromAddress = segments.find((segment) => cityPattern.test(segment));
  if (cityFromAddress) {
    return {
      city: cityFromAddress,
      country: "Japan"
    };
  }

  return {
    city: plusCodeSegments[0] ?? "",
    country: "Japan"
  };
}

function getHoursText(): string[] {
  const texts = new Set<string>();
  const selector = [
    "[aria-label*='Hours']",
    "[aria-label*='Open']",
    "[jsaction*='pane.openhours']",
    "[jslog*='hours']",
    "button[data-item-id='oh']",
    "[data-item-id='oh']"
  ].join(", ");

  const rows = Array.from(document.querySelectorAll<HTMLElement>(selector));

  const addCandidate = (value: string | null | undefined) => {
    const normalized = value?.replace(/\s+/g, " ").trim();
    if (normalized && countDistinctDays(normalized) >= 2) {
      texts.add(normalized);
    }
  };

  rows.forEach((row) => {
    addCandidate(row.innerText || row.textContent);
    addCandidate(row.getAttribute("aria-label"));
  });

  Array.from(document.querySelectorAll<HTMLElement>("[role='main'] *")).forEach((element) => {
    const text = element.innerText?.trim() || element.textContent?.trim();
    if (!text || text.length > 500) {
      return;
    }

    if (countDistinctDays(text) >= 2) {
      texts.add(text);
    }
  });

  const pageText = getPageText();
  if (countDistinctDays(pageText) >= 2) {
    texts.add(pageText);
  }

  return Array.from(texts).sort((left, right) => countDistinctDays(right) - countDistinctDays(left) || left.length - right.length);
}

function normalizeHoursValue(value: string): string {
  const cleaned = value
    .replace(/^[,:;\s]+/, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/^\)\s*,?\s*/, "")
    .replace(/,\s*Holiday[^,]*/gi, "")
    .replace(/,\s*Copy\s+(open|close)[^,]*/gi, "")
    .replace(/\s*[·•]\s*/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[^\p{L}\p{N}\s:.,\-\/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/,$/, "");

  const canonicalMatch = cleaned.match(
    /(Open 24 hours|Closed|[\d:]+\s*(?:am|pm)\s*(?:-|to)\s*[\d:]+\s*(?:am|pm))/i
  );

  if (canonicalMatch?.[1]) {
    return canonicalMatch[1].replace(/\s+/g, " ").trim();
  }

  return cleaned;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function canonicalDayName(rawDay: string): string | null {
  const normalized = rawDay.toLowerCase();

  for (const [canonical, aliases] of Object.entries(DAY_ALIASES)) {
    if (aliases.some((alias) => alias.toLowerCase() === normalized)) {
      return canonical;
    }
  }

  return null;
}

function countDistinctDays(text: string): number {
  const found = new Set<string>();
  for (const [canonical, aliases] of Object.entries(DAY_ALIASES)) {
    const pattern = new RegExp(`(?:^|\\b)(${aliases.map(escapeRegExp).join("|")})(?:\\b|\\s)`, "i");
    if (pattern.test(text)) {
      found.add(canonical);
    }
  }
  return found.size;
}

export function parseOpeningHoursText(texts: string[]): Record<string, string> {
  let bestMatch: Record<string, string> = {};

  texts.forEach((text) => {
    const normalized = text
      .replace(/Hours/gi, "")
      .replace(/Hide open hours for the week/gi, "")
      .trim();

    if (countDistinctDays(normalized) < 2) {
      return;
    }

    const openingHours: Record<string, string> = {};
    const dayToken = Object.values(DAY_ALIASES).flat().map(escapeRegExp).join("|");
    const pattern = new RegExp(`(${dayToken})\\s*[:\\-]?\\s*([\\s\\S]*?)(?=(?:${dayToken})\\s*[:\\-]?\\s*|$)`, "gi");

    for (const match of normalized.matchAll(pattern)) {
      const day = canonicalDayName(match[1]);
      const hours = normalizeHoursValue(match[2] ?? "");

      if (day && DAY_NAMES.has(day) && hours) {
        openingHours[day] = hours;
      }
    }

    if (Object.keys(openingHours).length > Object.keys(bestMatch).length) {
      bestMatch = openingHours;
    }
  });

  return Object.keys(bestMatch).length >= 2 ? bestMatch : {};
}

export function parseCityCountryFromAddress(address: string, plusCodeLocation = ""): { city: string; country: string } {
  const cleanedAddress = address.replace(/\s+/g, " ").trim();
  if (!cleanedAddress) {
    return { city: "", country: "" };
  }

  const locale = detectLocale(cleanedAddress, plusCodeLocation);
  if (locale === "singapore") {
    return parseSingaporeAddress(cleanedAddress);
  }

  if (locale === "japan") {
    return parseJapanAddress(cleanedAddress, plusCodeLocation);
  }

  const segments = cleanedAddress
    .split(",")
    .map(normalizeAddressSegment)
    .filter(Boolean);

  const plusCodeSegments = plusCodeLocation
    .split(",")
    .map(normalizeAddressSegment)
    .filter(Boolean);

  return {
    city: plusCodeSegments[0] ?? segments[segments.length - 2] ?? "",
    country: plusCodeSegments[plusCodeSegments.length - 1] ?? segments[segments.length - 1] ?? ""
  };
}

function parseOpeningHours(): Record<string, string> {
  return parseOpeningHoursText(getHoursText());
}

export function parseLatLngFromUrl(url: string): { latitude: number | null; longitude: number | null } {
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return {
      latitude: Number(atMatch[1]),
      longitude: Number(atMatch[2])
    };
  }

  const queryMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (queryMatch) {
    return {
      latitude: Number(queryMatch[1]),
      longitude: Number(queryMatch[2])
    };
  }

  return {
    latitude: null,
    longitude: null
  };
}

export function isGoogleMapsPlacePage(url: string): boolean {
  const isMapsUrl = /google\.com\/maps|maps\.google\.com/.test(url);
  const hasPlaceSignals = Boolean(
    getText(["h1", "[role='main'] h1", "[role='main'] [aria-level='1']"]) ||
      getButtonText("address") ||
      getButtonText("authority")
  );

  return isMapsUrl && hasPlaceSignals;
}

export function extractDraftFromPage(url: string): PlaceDraft {
  const draft = createEmptyDraft();
  const { latitude, longitude } = parseLatLngFromUrl(url);
  const pageText = getPageText();
  const plusCodeLocation = extractPlusCodeLocation(pageText);
  const name = getText(["h1", "[role='main'] h1", "[role='main'] [aria-level='1']"]);
  const address =
    getText(["button[data-item-id='address'] .fontBodyMedium", "button[data-item-id='address']"]) ||
    getButtonText("address");
  const website = getWebsiteUrl();
  const openingHours = parseOpeningHours();
  const { city, country } = parseCityCountryFromAddress(address, plusCodeLocation);

  draft.name = name;
  draft.city = city;
  draft.country = country;
  draft.address = address;
  draft.website = website;
  draft.google_maps_url = url;
  draft.source_url = url;
  draft.latitude = latitude;
  draft.longitude = longitude;
  draft.opening_hours = openingHours;

  if (name) {
    setMeta(draft, "name", { confidence: "medium", source: "maps_dom" });
  }
  if (address) {
    setMeta(draft, "address", { confidence: "medium", source: "maps_dom" });
  }
  if (city) {
    setMeta(draft, "city", { confidence: "medium", source: "maps_dom", note: "Derived from Maps address text." });
  }
  if (country) {
    setMeta(draft, "country", { confidence: "medium", source: "maps_dom", note: "Derived from Maps address text." });
  }
  if (website) {
    setMeta(draft, "website", { confidence: "medium", source: "maps_dom" });
  }
  if (Object.keys(openingHours).length > 0) {
    setMeta(draft, "opening_hours", { confidence: "medium", source: "maps_dom" });
  }
  if (latitude !== null && longitude !== null) {
    setMeta(draft, "latitude", { confidence: "high", source: "maps_url" });
    setMeta(draft, "longitude", { confidence: "high", source: "maps_url" });
  }

  return draft;
}
