# Data Model

Use UUID primary keys, created_at/updated_at timestamps, and foreign keys. Exact SQL migrations should be created and reviewed during implementation.

## Core tables

### profiles
- id (auth user ID)
- display_name
- timezone (default Asia/Makassar; editable)
- created_at, updated_at

### project_settings
- id
- owner_id
- project_name (default CeritaObim Studio)
- channel_name (cerita_obim)
- language (id-ID)
- niche
- tone_guide
- visual_style_guide
- character_description
- character_reference_asset_ids (JSON/related assets)
- default_duration_seconds (default 70)
- target_scene_seconds_min (default 6)
- target_scene_seconds_max (default 10)
- output_aspect_ratio (9:16)
- output_width (1080)
- output_height (1920)
- no_subtitles (true)
- weekly_video_target
- daily_budget_limit
- monthly_budget_limit
- max_scene_retries
- target_platforms (JSON/related records)

### content_items
- id
- owner_id
- content_code (unique, e.g. CO-2026-001)
- title
- category
- topic
- hook
- narration
- target_duration_seconds
- factual_claims (JSON)
- source_urls (JSON)
- verification_status (draft / needs_verification / verified / rejected)
- content_status (idea / planned / script_approved / in_production / assembled / approved / ready_to_publish / published / archived)
- source_batch_id
- published_at (nullable)
- created_at, updated_at

### content_batches
- id
- owner_id
- batch_name
- target_week_start
- target_video_count
- status
- settings_snapshot (JSON)
- estimated_total_cost
- actual_total_cost
- created_at, started_at, completed_at

### scenes
- id
- content_id
- scene_index
- start_ms
- end_ms
- narration_text
- visual_action
- camera_direction
- continuity_notes
- prompt_text
- timestamp_status (actual / estimated / manually_adjusted)
- scene_status
- source_alignment_metadata (JSON)
- created_at, updated_at
- unique(content_id, scene_index)

### assets
- id
- owner_id
- content_id (nullable)
- scene_id (nullable)
- asset_type (reference_image / voice_audio / scene_video / final_video / thumbnail / export / log)
- storage_path
- original_filename
- mime_type
- size_bytes
- duration_ms (nullable)
- width, height (nullable)
- checksum
- metadata (JSON)
- created_at

### production_jobs
- id
- owner_id
- batch_id
- content_id (nullable)
- scene_id (nullable)
- job_type
- status
- provider_key
- provider_model
- provider_request_id (nullable)
- input_hash
- idempotency_key
- progress_percent
- attempt_count
- max_attempts
- estimated_cost
- actual_cost (nullable)
- currency_or_credit_unit
- started_at, finished_at
- error_code (nullable)
- safe_error_message (nullable)
- retryable
- output_asset_ids (JSON)
- created_at, updated_at

### provider_configs
- id
- owner_id
- provider_key
- display_name
- enabled
- auth_mode
- secret_reference (reference to deployment secret manager; never raw secret in a readable table)
- configured_capabilities (JSON)
- last_test_status
- last_tested_at
- notes

### budget_ledger
- id
- owner_id
- provider_key
- model
- job_id (nullable)
- event_type (estimate / reservation / charge / refund / manual_balance_update)
- amount
- unit
- source (provider_api / user_entered / estimate)
- occurred_at
- metadata (JSON)

### platform_publications
- id
- content_id
- platform (tiktok / youtube / instagram)
- status (not_prepared / prepared / scheduled_manually / published / failed)
- title
- caption
- hashtags (JSON)
- planned_publish_at
- published_url (nullable)
- notes
- updated_at

### analytics_snapshots (future-ready)
- id
- content_id
- platform
- captured_at
- views
- likes
- comments
- shares
- saves
- average_watch_seconds
- completion_rate
- source (manual / API)
- metadata (JSON)

## Relationship summary
- One owner has one project configuration and many content batches.
- One batch contains many content items and production jobs.
- One content item has many scenes, assets, jobs, and platform publication records.
- One scene can have multiple prompt versions and generated assets in future; do not overwrite old assets destructively.
- Costs link to jobs through budget_ledger.

## Data integrity rules
- Content code is unique per owner.
- Scene indexes are sequential per content.
- start_ms < end_ms for every scene.
- Scene timestamps should not overlap unexpectedly; if gaps exist, flag them.
- Narration coverage must be validated against alignment spans.
- Never delete old content when generating a new batch.
- Use soft archive for content; hard delete requires explicit user action.
