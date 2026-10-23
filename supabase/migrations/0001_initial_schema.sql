-- =============================================================================
-- CeritaObim Studio — Initial Database Schema & RLS Policies (Milestone 1+)
-- =============================================================================

create extension if not exists "pgcrypto";

-- Updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1. profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Creator cerita_obim',
  timezone text not null default 'Asia/Makassar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- 2. project_settings
create table if not exists public.project_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique,
  project_name text not null default 'CeritaObim Studio',
  channel_name text not null default 'cerita_obim',
  language text not null default 'id-ID',
  timezone text not null default 'Asia/Makassar',
  niche text not null default 'Fakta unik, sains populer, sejarah singkat, dan keingintahuan sehari-hari',
  tone_guide text not null default 'Hangat, penasaran, jelas, bercerita cepat tanpa bertele-tele, bahasa Indonesia kasual-edukatif.',
  visual_style_guide text not null default 'Handmade origami paper stop-motion; setiap karakter, objek, properti, dan latar belakang tampak terbuat dari kertas lipat; tanpa manusia/objek fotorealistik; tanpa subtitle atau teks di dalam video.',
  character_description text not null default 'Karakter kertas origami lipat bertekstur kertas doff dengan lipatan geometris tegas, ekspresi ramah dan proporsi konsisten.',
  character_reference_asset_ids jsonb not null default '[]'::jsonb,
  default_duration_seconds integer not null default 70 check (default_duration_seconds between 15 and 180),
  target_scene_seconds_min integer not null default 6 check (target_scene_seconds_min between 3 and 20),
  target_scene_seconds_max integer not null default 10 check (target_scene_seconds_max between 4 and 30),
  output_aspect_ratio text not null default '9:16',
  output_width integer not null default 1080,
  output_height integer not null default 1920,
  no_subtitles boolean not null default true,
  weekly_video_target integer not null default 2 check (weekly_video_target between 1 and 21),
  daily_budget_limit numeric(12,2) not null default 10.00,
  monthly_budget_limit numeric(12,2) not null default 50.00,
  max_scene_retries integer not null default 2 check (max_scene_retries between 0 and 5),
  video_generation_mode text not null default 'semi_manual_flow' check (video_generation_mode in ('semi_manual_flow', 'api_provider')),
  target_platforms jsonb not null default '["tiktok", "youtube", "instagram"]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_project_settings_updated_at on public.project_settings;
create trigger trg_project_settings_updated_at
before update on public.project_settings
for each row execute function public.set_updated_at();

-- 3. content_batches
create table if not exists public.content_batches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  batch_name text not null,
  target_week_start date not null,
  target_video_count integer not null default 2,
  status text not null default 'draft',
  settings_snapshot jsonb not null default '{}'::jsonb,
  estimated_total_cost numeric(12,4) not null default 0,
  actual_total_cost numeric(12,4),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- 4. content_items
create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  content_code text not null,
  title text not null,
  category text not null default 'Sains & Keingintahuan',
  topic text not null,
  hook text not null default '',
  narration text not null default '',
  cta text not null default 'Apa pendapatmu? Tulis di kolom komentar!',
  tiktok_caption text not null default '',
  youtube_description text not null default '',
  instagram_caption text not null default '',
  notes text not null default '',
  target_duration_seconds integer not null default 70 check (target_duration_seconds between 15 and 180),
  factual_claims jsonb not null default '[]'::jsonb,
  source_urls jsonb not null default '[]'::jsonb,
  verification_status text not null default 'needs_verification'
    check (verification_status in ('draft', 'needs_verification', 'verified', 'rejected')),
  content_status text not null default 'idea'
    check (content_status in ('idea', 'planned', 'script_approved', 'in_production', 'assembled', 'approved', 'ready_to_publish', 'published', 'archived')),
  source_batch_id uuid references public.content_batches(id) on delete set null,
  is_demo boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, content_code)
);

drop trigger if exists trg_content_items_updated_at on public.content_items;
create trigger trg_content_items_updated_at
before update on public.content_items
for each row execute function public.set_updated_at();

-- 5. scenes
create table if not exists public.scenes (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  scene_index integer not null check (scene_index >= 1),
  start_ms integer not null check (start_ms >= 0),
  end_ms integer not null check (end_ms > start_ms),
  narration_text text not null,
  visual_action text not null default '',
  camera_direction text not null default '',
  continuity_notes text not null default '',
  prompt_text text not null default '',
  timestamp_status text not null default 'estimated'
    check (timestamp_status in ('actual', 'estimated', 'manually_adjusted')),
  scene_status text not null default 'draft',
  source_alignment_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(content_id, scene_index)
);

drop trigger if exists trg_scenes_updated_at on public.scenes;
create trigger trg_scenes_updated_at
before update on public.scenes
for each row execute function public.set_updated_at();

-- 6. assets
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  content_id uuid references public.content_items(id) on delete set null,
  scene_id uuid references public.scenes(id) on delete set null,
  asset_type text not null
    check (asset_type in ('reference_image', 'voice_audio', 'scene_video', 'final_video', 'thumbnail', 'export', 'log')),
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  duration_ms integer,
  width integer,
  height integer,
  checksum text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 7. production_jobs
create table if not exists public.production_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  batch_id uuid references public.content_batches(id) on delete cascade,
  content_id uuid references public.content_items(id) on delete set null,
  scene_id uuid references public.scenes(id) on delete set null,
  job_type text not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'waiting_for_user', 'succeeded', 'failed', 'cancelled', 'paused')),
  provider_key text not null,
  provider_model text not null default '',
  provider_request_id text,
  input_hash text not null default '',
  idempotency_key text not null unique,
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  estimated_cost numeric(12,4) not null default 0,
  actual_cost numeric(12,4),
  currency_or_credit_unit text not null default 'USD',
  started_at timestamptz,
  finished_at timestamptz,
  error_code text,
  safe_error_message text,
  retryable boolean not null default true,
  output_asset_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_production_jobs_updated_at on public.production_jobs;
create trigger trg_production_jobs_updated_at
before update on public.production_jobs
for each row execute function public.set_updated_at();

-- 8. provider_configs
create table if not exists public.provider_configs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  provider_key text not null,
  display_name text not null,
  enabled boolean not null default false,
  auth_mode text not null default 'env_secret',
  secret_reference text not null default '',
  configured_capabilities jsonb not null default '{}'::jsonb,
  last_test_status text not null default 'untested',
  last_tested_at timestamptz,
  notes text not null default '',
  unique(owner_id, provider_key)
);

-- 9. budget_ledger
create table if not exists public.budget_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  provider_key text not null,
  model text not null default '',
  job_id uuid references public.production_jobs(id) on delete set null,
  event_type text not null
    check (event_type in ('estimate', 'reservation', 'charge', 'refund', 'manual_balance_update')),
  amount numeric(12,4) not null default 0,
  unit text not null default 'USD',
  source text not null default 'estimate'
    check (source in ('provider_api', 'user_entered', 'estimate')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- 10. platform_publications
create table if not exists public.platform_publications (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  platform text not null check (platform in ('tiktok', 'youtube', 'instagram')),
  status text not null default 'not_prepared'
    check (status in ('not_prepared', 'prepared', 'scheduled_manually', 'published', 'failed')),
  title text not null default '',
  caption text not null default '',
  hashtags jsonb not null default '[]'::jsonb,
  planned_publish_at timestamptz,
  published_url text,
  notes text not null default '',
  updated_at timestamptz not null default now(),
  unique(content_id, platform)
);

drop trigger if exists trg_platform_publications_updated_at on public.platform_publications;
create trigger trg_platform_publications_updated_at
before update on public.platform_publications
for each row execute function public.set_updated_at();

-- 11. analytics_snapshots
create table if not exists public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  platform text not null check (platform in ('tiktok', 'youtube', 'instagram')),
  captured_at timestamptz not null default now(),
  views integer not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  saves integer not null default 0,
  average_watch_seconds numeric(8,2),
  completion_rate numeric(5,2),
  source text not null default 'manual' check (source in ('manual', 'API')),
  metadata jsonb not null default '{}'::jsonb
);

-- =============================================================================
-- Row Level Security (RLS) Policies — Owner-Only Access
-- =============================================================================
alter table public.profiles enable row level security;
alter table public.project_settings enable row level security;
alter table public.content_batches enable row level security;
alter table public.content_items enable row level security;
alter table public.scenes enable row level security;
alter table public.assets enable row level security;
alter table public.production_jobs enable row level security;
alter table public.provider_configs enable row level security;
alter table public.budget_ledger enable row level security;
alter table public.platform_publications enable row level security;
alter table public.analytics_snapshots enable row level security;

create policy "Owner can manage own profile"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Owner can manage own project_settings"
  on public.project_settings for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owner can manage own content_batches"
  on public.content_batches for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owner can manage own content_items"
  on public.content_items for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owner can manage scenes of own content"
  on public.scenes for all
  using (exists (
    select 1 from public.content_items ci
    where ci.id = scenes.content_id and ci.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.content_items ci
    where ci.id = scenes.content_id and ci.owner_id = auth.uid()
  ));

create policy "Owner can manage own assets"
  on public.assets for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owner can manage own production_jobs"
  on public.production_jobs for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owner can manage own provider_configs"
  on public.provider_configs for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owner can manage own budget_ledger"
  on public.budget_ledger for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owner can manage publications of own content"
  on public.platform_publications for all
  using (exists (
    select 1 from public.content_items ci
    where ci.id = platform_publications.content_id and ci.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.content_items ci
    where ci.id = platform_publications.content_id and ci.owner_id = auth.uid()
  ));

create policy "Owner can manage analytics of own content"
  on public.analytics_snapshots for all
  using (exists (
    select 1 from public.content_items ci
    where ci.id = analytics_snapshots.content_id and ci.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.content_items ci
    where ci.id = analytics_snapshots.content_id and ci.owner_id = auth.uid()
  ));
