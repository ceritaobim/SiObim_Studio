# Product Requirements Document (PRD)
## CeritaObim Studio

- Version: 1.0
- Status: Initial product specification
- Product owner: Creator of cerita_obim
- Primary language: Indonesian
- Platforms: TikTok, YouTube Shorts, Instagram Reels
- Product type: Private, single-owner web app; mobile-first and installable as a PWA

## 1. Executive summary

CeritaObim Studio is a web application that manages a recurring AI-assisted video production workflow. It replaces repetitive prompt copying, spreadsheet handoffs, manual timestamp segmentation, fragmented asset storage, and manual tracking of AI credits with one persistent workspace.

The owner should be able to set preferences once, create a weekly production batch, review important decisions, and monitor the workflow from a phone or desktop. Completed videos are exported for manual upload to TikTok, YouTube Shorts, and Instagram Reels.

The product must not assume that every AI provider exposes an API. It must support real integrations when available and an explicit semi-manual workflow when not.

## 2. Problem statement

Current workflow:
1. Create weekly content planning with an AI chat tool.
2. Export a spreadsheet with title, description, and narration.
3. Generate Indonesian voice-over in ElevenLabs, sometimes across multiple free-plan accounts because of credit constraints.
4. Listen to MP3 and manually split narration into roughly 10-second segments.
5. Create a prompt for each segment and generate clips in Google Flow.
6. Combine clips and audio manually in CapCut.
7. Upload to social platforms manually.

Pain points:
- Too much repetitive copy/paste and manual listening.
- Narration can be cut in the middle of a sentence.
- Prompts and character/visual consistency are difficult to maintain.
- Credit limits make production planning uncertain.
- Assets and production status are spread across services.
- The owner has only one free day per week.
- One final video must be packaged for three social platforms.

## 3. Product vision

A single control center that remembers the content history and production rules, coordinates available AI services, produces a final MP4, and prepares platform-specific publishing materials with as little repeated user input as possible.

## 4. Goals

1. Store all content and production history in one database.
2. Generate weekly content plans that avoid duplicating prior topics and angles.
3. Generate or import voice-over audio and align text to actual timestamps.
4. Turn timestamped narration into scene plans and ready-to-copy video prompts.
5. Track video generation tasks, costs, failures, and retries.
6. Assemble scene clips with narration into a vertical final MP4.
7. Provide a responsive interface usable from a phone.
8. Produce publication packages for TikTok, YouTube Shorts, and Instagram Reels.
9. Let the owner start a batch and monitor progress without keeping the browser open.
10. Keep the MVP safe and achievable without relying on unsupported Google Flow automation.

## 5. Non-goals for MVP

- Automatic social publishing.
- Automated login/account switching to bypass Google Flow limits.
- Storing Google account passwords or session cookies.
- Guaranteeing social media monetization or virality.
- Generating perfect continuity solely from text prompts.
- Replacing human review for factual accuracy.
- Multi-user team collaboration and complex role permissions.
- Mobile-native app; responsive web/PWA is sufficient.
- Building a proprietary video model.

## 6. Target user

One creator/operator who:
- Produces Indonesian facts/curiosity videos.
- Has only one free day per week for production.
- Uses AI for planning, narration, and visuals.
- Wants a repeatable batch workflow and low repeated input.
- Wants the same clean master video for three social platforms.
- Needs to control credit usage and avoid losing completed work.

## 7. Product principles

- Configure once, reuse every week.
- Database is the source of truth; spreadsheets are import/export formats.
- Never silently invent facts, timestamps, costs, or integration success.
- Persist progress after every completed step.
- Retry only failed work, not the whole batch.
- Human approval gates for topics, final script, and final video.
- Mobile-first but optimized for batch operations on desktop too.
- Provider-agnostic architecture.
- Respect API quotas and provider terms.

## 8. Core user journey

### First-time setup
1. Open the app and sign in.
2. Configure channel identity, language, target duration, style guide, main character references, default scene duration, budget, and publishing platforms.
3. Add existing content history by importing `contentplan.xlsx`.
4. Configure provider credentials for supported integrations.
5. Select generation mode for video: supported API provider or semi-manual Flow mode.

### Weekly batch
1. Tap **Create weekly batch**.
2. The app reads prior content and analytics already stored in the database.
3. AI proposes a content plan with fact sources and duplication checks.
4. User reviews/approves the plan.
5. The system writes final scripts and platform metadata.
6. Voice-over is generated through configured TTS or imported manually.
7. Audio alignment returns word/character timestamps; system builds scene segments around natural sentence/clause boundaries.
8. Scene prompts are generated from the persistent visual style and scene plan.
9. Video clips are generated via a supported API, or prompts are exported for manual Google Flow production and the resulting clips are uploaded back to the app.
10. The app validates clip order/duration and assembles video plus narration.
11. User reviews the final MP4.
12. The app exports a publishing package with MP4, titles, descriptions, captions, hashtags, and a checklist for all three platforms.
13. User uploads/schedules manually on each platform and records publication URLs/status if desired.

## 9. Functional requirements

### FR-01 — Project settings
- Save channel name, language, niche, tone, visual identity, character description/reference assets, default duration, scene duration, output resolution, platform targets, and budget.
- Settings are reused automatically in every batch.
- Allow per-video overrides without changing global defaults.

### FR-02 — Content library
- Store content ID, topic, title, category, hook, narration, factual claims, source URLs, verification status, duration target, and production status.
- Search/filter by title, topic, category, status, date, and platform.
- Detect exact and semantic topic overlap with prior content; show warnings, not silent deletion.
- Import and export XLSX/CSV.
- New weekly plans append new rows; existing records are never overwritten by default.

### FR-03 — Weekly planning
- Generate configurable number of ideas (default 7 proposals; owner may produce fewer).
- Use prior library and performance metrics as context.
- Produce title, hook, full narration, source URLs, caption variants, CTA, target duration, and verification status.
- Mark unverified claims as needing verification.
- Provide approve, reject, edit, and regenerate actions.
- Record model/provider, run date, and errors.

### FR-04 — Script and voice
- Final narration is stored separately from scene descriptions.
- Support TTS provider adapter and manual MP3 upload.
- If using ElevenLabs API, support timestamp-capable endpoint when available for the selected model/endpoint.
- Store audio asset, duration, provider, model/voice ID, and generation metadata.
- Never infer exact audio timing from text alone. If timestamps are estimated, label them ESTIMATED.

### FR-05 — Timestamp alignment and scene segmentation
- Accept word/character alignment or a forced-alignment provider result.
- Group text around natural sentence/clause boundaries within configurable target scene duration.
- Default target scene duration is 6–10 seconds, but must match selected video provider limits.
- Never drop or duplicate narration text.
- Validate that all text spans are accounted for and all timestamps are ordered.
- Allow manual adjustment to scene boundaries.
- Clearly flag overlong/short scenes and uncertainty.

### FR-06 — Scene prompt generation
- Build prompts using stored style guide, character reference, scene context, previous scene continuity, narration segment, and target duration.
- Include no-subtitle/no-on-screen-text instruction by default.
- Generate scene IDs and deterministic filenames, e.g. `CO-2026-001_SCENE_001.mp4`.
- Export all prompts as TXT/CSV/XLSX.
- Later scenes should refer to the previous scene/reference when the provider supports it; do not claim that text alone guarantees perfect continuity.

### FR-07 — Video provider modes
Mode A: supported API provider
- Submit generation jobs through a documented provider API.
- Track request ID, job state, cost, and resulting asset.
- Poll/webhook according to provider documentation.
- Respect rate limits and provider quotas.

Mode B: semi-manual Google Flow
- Generate a copy-ready scene prompt pack and numbered scene checklist.
- Let the user generate clips in Flow using the provider UI.
- Allow upload of generated clips, matching filenames to scene IDs.
- Show missing clips and allow batch upload.
- Do not automate Google login/account switching or evade per-account limits.
- Do not show the task as API-generated unless the integration actually succeeded.

### FR-08 — Cost and budget management
- Store estimated and actual cost/credits by provider, model, job, and date.
- Support user-entered quota balances when no official balance API is available.
- Do not assume credit balance can be read automatically.
- Configure daily/monthly spending caps and maximum retries.
- Pause paid jobs when the budget is exceeded or balance is unknown and policy requires confirmation.
- Estimate cost before starting a batch and show best/expected/worst-case scenarios where data supports it.
- Avoid duplicate paid calls on retries by using idempotency keys and persisted job states where supported.

### FR-09 — Video assembly
- Assemble clips in scene order with the original narration.
- Normalize dimensions, frame rate, codec, audio sample rate, and loudness using configurable FFmpeg presets.
- Detect missing clips, unexpected duration, black frames where feasible, and audio shorter/longer than video.
- Produce a vertical 9:16 master MP4 suitable for the target platforms.
- Keep original audio and clips.
- Save logs and an assembly report.
- Do not add subtitles or watermark by default.
- Provide a preview and approve/reject/regenerate options.

### FR-10 — Publishing package
- Generate separate platform metadata for TikTok, YouTube Shorts, and Instagram Reels.
- Include final MP4, title, caption/description, CTA, hashtags, and suggested publish date/time.
- Provide copy buttons and a checklist.
- MVP upload/publishing remains manual.
- Track draft, ready, published, and publication URL/status.
- Do not claim to have uploaded content unless the user confirms it or a supported API returns success.

### FR-11 — Batch/job monitoring
- Display batch progress, current step, queued/running/failed/completed jobs, estimated remaining work when calculable, and last error.
- Allow pause/resume/cancel where safe.
- Retry failed step only.
- Persist state when user closes the browser or switches devices.
- Notify in-app; optional email notification can be future work.

### FR-12 — Responsive/PWA
- Usable at 360px width and larger.
- Installable PWA if feasible; no requirement for offline AI generation.
- Mobile home dashboard prioritizes progress, failed tasks, approval requests, and ready-to-publish videos.
- Large tables become cards or horizontally scrollable tables on mobile.
- Uploads support mobile file picker and desktop drag-and-drop.

## 10. Non-functional requirements

- Authentication required; single-owner mode for MVP.
- All provider keys are server-side secrets.
- Server-side validation and authorization on every mutation.
- Long-running work runs in background workers.
- Job processing is durable and resumable.
- All generated assets have stable IDs and paths.
- Logs avoid secrets and sensitive tokens.
- Basic audit trail for changes and provider calls.
- Tests for cost calculations, job transitions, timestamp integrity, and assembly manifest.
- Accessible labels, keyboard navigation, visible focus, and error feedback.
- Clear provider integration status and limitations.

## 11. Success metrics

Initial operational metrics:
- Weekly setup requires minimal repeated manual input.
- Percentage of scenes generated without manual prompt rewriting.
- Number of manual audio-segmentation steps eliminated.
- Batch completion rate.
- Average number of retries per video.
- Cost per completed video.
- Time from approved script to final MP4.
- Number of failed jobs that can resume without restarting the batch.
- Percentage of videos with complete publishing packages.

Social performance metrics can be entered/imported later: views, average watch time, completion rate, shares, saves, comments, and follower change. Do not optimize only for view count.

## 12. MVP release scope

MVP should include:
- Authentication and project settings.
- Content library and XLSX import/export.
- Weekly planning through an LLM adapter.
- Manual script approval/editing.
- TTS API adapter or MP3 upload.
- Timestamp alignment import and scene segmentation.
- Scene prompt generation/export.
- Semi-manual Flow mode and batch clip upload.
- FFmpeg assembly.
- Cost tracking, durable jobs, retries, and status dashboard.
- Publishing packages for three platforms.
- Mobile responsive PWA shell.

## 13. Later releases
- Direct video generation through documented provider APIs.
- Provider usage/balance synchronization where officially available.
- Automated analytics ingestion.
- Publishing integrations where official APIs and permissions allow.
- Email/push notifications.
- More advanced semantic duplicate detection and analytics-driven topic ranking.
