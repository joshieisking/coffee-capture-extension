create extension if not exists pgcrypto;

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null default '',
  country text not null default '',
  address text not null,
  notes text not null default '',
  website text not null default '',
  instagram text not null default '',
  google_maps_url text not null,
  brew_methods text[] not null default '{}',
  roaster_partners text[] not null default '{}',
  roasts_in_house boolean,
  confidence_score integer,
  source_url text not null default '',
  source_page text not null default 'Google Maps',
  source_name text not null default 'Google Maps Capture',
  source_year integer,
  latitude double precision,
  longitude double precision,
  opening_hours jsonb not null default '{}'::jsonb,
  rank integer,
  google_place_id text not null default '',
  source_hash text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists places_google_maps_url_key
  on public.places (google_maps_url);

create unique index if not exists places_google_place_id_key
  on public.places (google_place_id)
  where google_place_id <> '';

create index if not exists places_name_idx
  on public.places (lower(name));
