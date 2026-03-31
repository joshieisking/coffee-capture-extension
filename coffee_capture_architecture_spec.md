# Coffee Capture Architecture Spec

## Goal
Build a personal Chrome extension that captures a coffee shop from Google Maps, enriches the data, shows a review sidebar, and writes a clean record to Supabase only after approval.

## Broader system context
This extension is not the end-user product. It feeds a separate frontend web app, Distilled (`distilled.coffee`), which reads curated coffee-shop records from Supabase and presents them on an embedded Google Map.

That means the capture pipeline has an additional responsibility:
- preserve strict compatibility with the frontend app’s existing data expectations
- optimize for clean curated data, because malformed records will surface directly in the public browsing experience
- avoid schema drift unless the frontend app is updated in lockstep

## Guiding principle
Do not make the extension the brain. Make it the capture and review UI. Put place resolution, enrichment, and database writes behind backend services.

## Cost-aware implementation decision
To keep the project low-cost for now, do not use the Google Places API in the current implementation.

Instead:
- Use Google Maps page scraping as the primary capture method
- Use website enrichment as the secondary source for additional metadata
- Treat missing data conservatively and surface it for review
- Keep the option open to add Places API later if cost/accuracy tradeoffs change

## Compatibility rule
Do not change the shape or meaning of the Supabase fields currently consumed by the frontend app.

Important compatibility expectations gathered from the frontend app:
- target dataset is the curated coffee shop table consumed by the Distilled web app
- `country` should remain a full country name
- `opening_hours` should remain JSON in the scraper-style format, e.g. `{ "friday": "7 am-10 pm" }`
- `google_maps_url` should remain the canonical deep link back to Google Maps
- `notes` may be stored, but is not currently shown in the frontend UI
- frontend display derives additional UI state from fields like `opening_hours`, `brew_methods`, `roaster_partners`, `roasts_in_house`, `source_name`, and `confidence_score`

## High-level architecture

**Chrome Side Panel Extension** → **Backend API / Edge Functions** → **Scraper-first Resolver / Normalizer** → **Website Enrichment Worker** → **Classifier / Normalizer** → **Supabase Write API** → **Supabase Table**

---

## Core components

### 1) Chrome extension
**Purpose:** Detect a Google Maps place page, build a draft record, show it in a sidebar, and send the approved payload to the backend.

**Main responsibilities:**
- Detect Google Maps place pages
- Extract visible listing data from the page
- Parse latitude and longitude from the Maps URL
- Create a draft record immediately
- Show an editable side panel
- Let the user approve or cancel
- Send approved data to backend endpoints

**Suggested extension pieces:**
- `content-script`: reads Maps page and URL
- `side-panel-ui`: draft review form
- `background/service-worker`: message handling and API calls

---

### 2) Supabase Edge Functions
**Purpose:** Server-side API layer for resolving place IDs, enriching website metadata, and writing records.

**Recommended functions:**
- `POST /resolve-place`
- `POST /enrich-website`
- `POST /save-place`
- `POST /dedupe-check`

These can be implemented as Supabase Edge Functions or equivalent backend endpoints.

---

### 3) Google Places resolver service
**Purpose:** Convert a Google Maps candidate into a stable internal candidate using scraped Maps data first, with room to add Google Places later if needed.

**Responsibilities:**
- Normalize and clean scraped Maps data
- Produce a stable internal candidate identifier
- Return canonical details when available from scraper/backend heuristics
- Leave room for future Google Places integration if the cost/benefit changes

**Why it exists:**
- Keeps normalization logic off the extension
- Improves dedupe beyond raw URL matching
- Allows a future upgrade path without changing the extension UX

### Current implementation note
For the current low-cost version, this layer is heuristic and scraper-first rather than backed by Google Places.

---

### 4) Website enrichment worker
**Purpose:** Fetch the business website and extract metadata that Google Maps does not provide.

**Responsibilities:**
- Fetch HTML
- Read `<meta>` tags
- Read Open Graph tags
- Read schema.org JSON-LD
- Find Instagram links
- Detect roasting-related statements
- Detect brew method references
- Extract useful page title and description

---

### 5) Classifier / normalizer
**Purpose:** Turn raw website text into structured fields.

**Responsibilities:**
- Set `roasts_in_house` from evidence
- Build `brew_methods` array
- Build `roaster_partners` array
- Normalize city, country, address text
- Compute `confidence_score`
- Flag uncertain values for review

---

### 6) Supabase write layer
**Purpose:** Insert or update the final record.

**Responsibilities:**
- Validate payload
- Dedupe lookup
- Upsert or insert record
- Return saved row
- Record errors clearly

---

## Exact API endpoints

### `POST /resolve-place`
**Input:**
- `name`
- `address`
- `google_maps_url`
- `latitude`
- `longitude`

**Output:**
- stable internal `place_id`
- canonical name
- canonical address
- canonical coordinates
- confidence in match

---

### `POST /enrich-website`
**Input:**
- `website`
- optional `name`
- optional `place_id`

**Output:**
- `instagram`
- `roasts_in_house`
- `brew_methods`
- `roaster_partners`
- extracted metadata
- evidence snippets

---

### `POST /dedupe-check`
**Input:**
- `google_maps_url`
- `place_id`
- normalized `name`
- `city`
- `country`
- `latitude`
- `longitude`

**Output:**
- duplicate match status
- matched record if found
- match confidence

---

### `POST /save-place`
**Input:**
- full normalized record
- approval flag

**Output:**
- inserted or updated row
- saved record id
- status

---

## Database notes

Your table remains the source of truth:
- `name`
- `city`
- `country`
- `address`
- `notes`
- `website`
- `instagram`
- `google_maps_url`
- `brew_methods`
- `roaster_partners`
- `roasts_in_house`
- `confidence_score`
- `source_url`
- `source_page`
- `source_name`
- `source_year`
- `latitude`
- `longitude`
- `opening_hours`
- `rank`
- `created_at`

### Downstream frontend expectations
The Distilled frontend transforms the saved rows into a map-friendly app shape. As a result:
- `opening_hours` must remain parseable as scraper-style weekday strings
- `country` should be human-readable and complete
- `google_maps_url` should be preserved whenever available
- `source_name` and `source_url` matter because the frontend exposes provenance as “Found on [source]”
- `latitude` and `longitude` are required for the shop to appear on the map
- `notes` can be stored for curation but is not rendered in the frontend

### Current integration reality
The frontend app documentation refers to a `coffee_shops` table as the live source. This extension should treat the existing production schema and meanings as fixed, even if local scaffolding names differ during development.

### Recommended future schema improvement
Add:
- `google_place_id`
- `source_hash`

These will make dedupe and syncing much better.

---

## Build order for Codex

### Phase 1: Extension shell
1. Create Manifest V3 extension.
2. Add Side Panel UI.
3. Add content script for Google Maps detection.
4. Parse latitude and longitude from the URL.
5. Build local draft state.

### Phase 2: Review experience
6. Render editable fields in the sidebar.
7. Add multi-select dropdown for `brew_methods`.
8. Add approve / cancel actions.
9. Show validation errors inline.

### Phase 3: Backend resolution
10. Create `resolve-place` endpoint.
11. Keep resolver scraper-first and heuristic for the low-cost version.
12. Return stable internal place ID and confidence.

### Phase 4: Website enrichment
13. Create `enrich-website` endpoint.
14. Fetch and parse website HTML.
15. Extract meta tags, Open Graph tags, schema.org JSON-LD.
16. Detect Instagram links.
17. Infer roasting and brew method signals.

### Phase 5: Deduping and save
18. Create `dedupe-check` endpoint.
19. Create `save-place` endpoint.
20. Validate payload against schema.
21. Upsert into Supabase.
22. Show success/failure in the sidebar.

### Phase 6: Quality and safety
23. Add confidence scoring.
24. Add audit logging.
25. Add retry and error handling.
26. Add tests for parser and normalizer logic.

---

## Suggested payload shape

```json
{
  "name": "Example Coffee",
  "city": "Singapore",
  "country": "Singapore",
  "address": "123 Example St, Singapore",
  "notes": "",
  "website": "https://example.com",
  "instagram": "https://instagram.com/example",
  "google_maps_url": "https://www.google.com/maps/...",
  "brew_methods": ["espresso", "pour over"],
  "roaster_partners": ["Onyx"],
  "roasts_in_house": false,
  "confidence_score": 90,
  "source_url": "https://www.google.com/maps/...",
  "source_page": "Google Maps",
  "source_name": "Google Maps Capture",
  "source_year": null,
  "latitude": 1.3521,
  "longitude": 103.8198,
  "opening_hours": {
    "monday": "07:00-17:00"
  }
}
```

## Frontend-driven quality implications
- Bad `opening_hours` formatting will break downstream normalization and open/closed display
- Wrong `country` formatting will degrade timezone derivation in the frontend
- Missing `latitude` or `longitude` means the shop will not render on the public map
- Incorrect `google_maps_url` weakens the handoff back to Google Maps
- Low-confidence inferred fields should stay blank rather than pollute the curated map experience

---

## What Codex should build first
Start with:
1. extension scaffold
2. side panel UI
3. draft extraction from Google Maps page
4. latitude / longitude parsing from URL
5. multi-select brew method control
6. approve-to-save flow

That gets you a working capture tool before enrichment makes it fancy.

## Current low-cost operating model
- Primary source: Google Maps page scraper
- Secondary source: business website enrichment
- Fallback for missing hours: user manually expands the Google Maps hours section, then retries capture
- No Places API dependency in the current implementation
- Output is shaped to remain compatible with the Distilled frontend app’s current Supabase-backed data contract

---

## Implementation rule
If a value is uncertain, leave it blank or null and surface it for review. Do not guess just to make the form look full.
