# Coffee Capture

Coffee Capture is a personal Chrome extension and Supabase backend for capturing coffee shops from Google Maps, reviewing the record, and saving a clean approved entry.

## System context
This project feeds a separate frontend web app, Distilled (`distilled.coffee`), which reads curated coffee-shop records from Supabase and renders them on an embedded Google Map.

Important downstream context from the web app:
- The frontend app is the public delivery surface; this extension is part of the curation/input workflow
- The frontend expects the existing Supabase schema and field meanings to remain stable
- `country` should be stored as a full country name, not an ISO code
- `opening_hours` should remain JSON in the scraper-style format, for example `{ "friday": "7 am-10 pm" }`
- `notes` exists in the database but is intentionally not shown in the web UI
- `google_maps_url` is used by the frontend as the primary "Open in Google Maps" deep link
- `brew_methods`, `roaster_partners`, `roasts_in_house`, `confidence_score`, `website`, and `instagram` are all meaningful downstream fields for the curated experience
- The broader product goal is low-friction discovery in the frontend app, so this extension should optimize for accurate, reviewable records rather than speed alone

## What is implemented
- Manifest V3 Chrome extension scaffold in [extension](/Users/joshuaooi/coffee-capture-extension/extension)
- Shared contracts, types, and validation in [shared](/Users/joshuaooi/coffee-capture-extension/shared)
- Supabase Edge Function scaffold and SQL schema in [backend](/Users/joshuaooi/coffee-capture-extension/backend)
- React side panel review UI with editable fields and approve/cancel flow
- Google Maps content-script capture for:
  - name
  - address
  - website
  - Google Maps URL
  - latitude / longitude
  - city / country heuristics for Singapore and Japan
  - opening-hours capture from visible Google Maps hours content
- Retry capture workflow for cases where you manually expand hours before re-capturing
- Backend endpoints for:
  - `resolve-place`
  - `dedupe-check`
  - `save-place`
  - `enrich-website`
- Website enrichment scaffold for Instagram, roast/brew signals, and metadata extraction

## Current product behavior
- The extension is intentionally scraper-first and low-cost.
- It does not currently use the Google Places API.
- The extension captures what is visibly available from the Google Maps page.
- Opening hours are captured when the weekly hours are visibly rendered on the page. If hours are blank, the current expected workflow is to expand the hours section in Google Maps and retry capture.
- Address normalization currently has extra handling for Singapore and Japan, with conservative fallbacks for other locales.
- The capture workflow is designed to preserve compatibility with the frontend app’s expected data shape and display logic.

## Local development
1. Install workspace dependencies with `npm install`.
2. Build the shared package with `npm run build -w shared`.
3. Build the extension with `npm run build -w extension`.
4. Load [extension/dist](/Users/joshuaooi/coffee-capture-extension/extension/dist) as an unpacked Chrome extension.
5. Run Supabase locally and serve the functions from [backend/functions](/Users/joshuaooi/coffee-capture-extension/backend/functions).

## Current scope
The current implementation covers a Phase 1 plus early Phase 2/4 baseline:
- detect a Google Maps place page
- extract a draft record from visible Maps content
- show and edit that draft in the side panel
- support brew-method selection and editable opening-hours JSON
- call backend `resolve-place`, `dedupe-check`, `enrich-website`, and `save-place`
- save only after approval
- keep output aligned with the live web app’s current Supabase-backed schema

## Known limitations
- Google Maps hours are not guaranteed to be present in the DOM until the user expands that section.
- Because the project is avoiding Places API for cost reasons, opening-hours capture is scraper-dependent and therefore not perfect.
- Locale-aware address parsing is stronger for Singapore and Japan than for other regions.
- Backend enrichment needs the local Supabase functions running in order to populate website-derived fields.
- The frontend web app currently derives additional display state from this data, so malformed or inconsistent values can degrade the public browsing experience even if the row saves successfully.

## Downstream compatibility requirements
- Do not change the database field names or meanings without coordinating with the frontend app.
- Keep `opening_hours` compatible with the web app’s normalization flow.
- Keep `country` as a readable full country name.
- Prefer conservative blanks over incorrect guesses, especially for location and hours fields.

Phase 2 and later should extend this baseline rather than replace it.
