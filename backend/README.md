# Backend

This folder contains Supabase Edge Functions for the Coffee Capture MVP.

## Functions
- `resolve-place`: Phase 1 heuristic resolver that returns a stable pseudo place ID from the Maps URL
- `dedupe-check`: checks for an existing record in `coffee_shops` by `google_maps_url` or `name + country`
- `save-place`: validates and upserts an approved record into `coffee_shops`
- `enrich-website`: fetches the business website and extracts Instagram / roast / brew clues

## Environment
- `SUPABASE_URL`
- `COFFEE_CAPTURE_SUPABASE_SECRET_KEY` (preferred custom secret name for hosted Edge Functions)
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` as local/legacy fallbacks

## Next phase
Phase 2 should replace the heuristic resolver with real Google Places lookup and add `enrich-website`.
