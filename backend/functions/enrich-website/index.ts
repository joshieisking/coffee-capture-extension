import { corsHeaders } from "../_shared/cors.ts";
import { badRequest, extractMetaContent, jsonResponse, readJson, stripHtml, validateEnrichWebsiteRequest } from "../_shared/utils.ts";
import type { EnrichWebsiteRequest } from "../_shared/types.ts";

const BREW_METHOD_PATTERNS = {
  espresso: /\bespresso\b/i,
  pour_over: /\b(pour[\s-]?over|v60|chemex|kalita)\b/i,
  batch_brew: /\b(batch brew|filter coffee)\b/i,
  aeropress: /\baeropress\b/i,
  syphon: /\b(syphon|siphon)\b/i,
  cold_brew: /\bcold brew\b/i,
  french_press: /\bfrench press\b/i,
  filter: /\bfilter\b/i
} as const;

function extractTitle(html: string): string {
  return html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? "";
}

function extractInstagram(html: string): string {
  const match = html.match(/https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._-]+/i);
  return match?.[0] ?? "";
}

function inferBrewMethods(text: string): Array<keyof typeof BREW_METHOD_PATTERNS> {
  return Object.entries(BREW_METHOD_PATTERNS)
    .filter(([, pattern]) => pattern.test(text))
    .map(([method]) => method as keyof typeof BREW_METHOD_PATTERNS);
}

function inferRoastsInHouse(text: string): { value: boolean | null; evidence: string[] } {
  const evidence: string[] = [];
  const positivePatterns = [
    /\b(roast(?:ing|ed)? (?:our own|in[-\s]?house|onsite|on site))\b/i,
    /\b(we roast)\b/i,
    /\b(house[-\s]?roasted)\b/i
  ];

  positivePatterns.forEach((pattern) => {
    const match = text.match(pattern);
    if (match?.[0]) {
      evidence.push(match[0]);
    }
  });

  if (evidence.length > 0) {
    return { value: true, evidence };
  }

  return { value: null, evidence: [] };
}

function inferRoasterPartners(text: string): string[] {
  const partners = new Set<string>();
  const patterns = [
    /\bbeans? (?:from|by)\s+([A-Z][A-Za-z0-9&' .-]{2,40})/g,
    /\bserving\s+([A-Z][A-Za-z0-9&' .-]{2,40})\s+beans/g
  ];

  patterns.forEach((pattern) => {
    for (const match of text.matchAll(pattern)) {
      const partner = match[1]?.trim();
      if (partner) {
        partners.add(partner);
      }
    }
  });

  return Array.from(partners);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const payload = await readJson<EnrichWebsiteRequest>(request);
  const errors = validateEnrichWebsiteRequest(payload);
  if (errors.length > 0) {
    return badRequest(errors.join(", "));
  }

  try {
    const response = await fetch(payload.website, {
      headers: {
        "User-Agent": "CoffeeCaptureBot/0.1 (+https://localhost)"
      }
    });

    if (!response.ok) {
      return jsonResponse({ error: `Unable to fetch website (${response.status})` }, 502);
    }

    const html = await response.text();
    const text = stripHtml(html);
    const title = extractTitle(html) || extractMetaContent(html, "og:title");
    const description = extractMetaContent(html, "description") || extractMetaContent(html, "og:description");
    const instagram = extractInstagram(html);
    const brewMethods = inferBrewMethods(`${title} ${description} ${text}`);
    const roastInference = inferRoastsInHouse(`${title} ${description} ${text}`);
    const roasterPartners = inferRoasterPartners(`${title} ${description} ${text}`);

    const evidence = [
      ...(instagram ? [`instagram:${instagram}`] : []),
      ...roastInference.evidence,
      ...brewMethods.map((method) => `brew_method:${method}`)
    ];

    return jsonResponse({
      status: "ok",
      data: {
        instagram,
        roasts_in_house: roastInference.value,
        brew_methods: brewMethods,
        roaster_partners: roasterPartners,
        metadata: {
          title,
          description
        },
        evidence
      },
      confidence: evidence.length > 0 ? 0.7 : 0.2,
      warnings: evidence.length > 0 ? [] : ["No strong enrichment signals found on the website."]
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown enrichment error" }, 500);
  }
});
