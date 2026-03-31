# Backend

This folder contains Supabase Edge Functions for the Coffee Capture MVP.

## Functions
- `resolve-place`: Phase 1 heuristic resolver that returns a stable pseudo place ID from the Maps URL
- `dedupe-check`: checks for an existing record by `google_place_id` or `google_maps_url`
- `save-place`: validates and upserts an approved record into `places`

## Environment
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Next phase
Phase 2 should replace the heuristic resolver with real Google Places lookup and add `enrich-website`.
