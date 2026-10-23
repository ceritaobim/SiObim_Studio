# Architecture — CeritaObim Studio

## Recommended initial stack

Use a boring, maintainable stack suitable for a single creator:
- Frontend/web app: Next.js App Router + TypeScript strict mode.
- Styling/UI: Tailwind CSS and a consistent accessible component library.
- Database/auth/storage: Supabase (PostgreSQL, Auth, object storage).
- Background jobs: Trigger.dev or an equivalent durable job runner. Choose one and document the choice; do not use browser timers for production work.
- Video assembly: FFmpeg in a worker/container with enough CPU/temp storage.
- AI adapters: server-side provider interfaces.
- Deployment: managed hosting for web plus a worker/runtime suitable for FFmpeg and long-running jobs.

Important: do not assume a serverless web request can run a long FFmpeg process. Use a worker environment that supports it.

## High-level components

1. Web UI
   - dashboard, content library, batch wizard, job monitor, scene editor, asset manager, publishing center, settings.
2. Application API
   - validates user input, authorizes access, starts jobs, returns persisted state.
3. Database
   - source of truth for content, batches, scenes, assets, jobs, provider settings metadata, costs, publishing records.
4. Background worker
   - executes planning, TTS, alignment, prompt generation, clip ingestion, and assembly tasks.
5. Provider adapters
   - LLMAdapter, TTSAdapter, AlignmentAdapter, VideoGenerationAdapter, StorageAdapter.
6. Object storage
   - audio, video clips, final MP4, thumbnails, prompt exports, assembly logs.
7. External services
   - LLM, ElevenLabs, supported video API provider. Google Flow semi-manual mode does not imply a direct API integration.

## Suggested folder structure

```text
src/
  app/
    (auth)/
    (dashboard)/
      page.tsx
      content/
      batches/
      production/
      assets/
      publishing/
      settings/
    api/
  components/
  features/
    content-library/
    content-planning/
    scripts/
    voice/
    scenes/
    video-generation/
    assembly/
    publishing/
    budgets/
  lib/
    auth/
    db/
    validation/
    providers/
      llm/
      tts/
      alignment/
      video/
    jobs/
    storage/
    costs/
  types/
  tests/
workers/
  tasks/
supabase/
  migrations/
  seed.sql
templates/
docs/
```

## Background job design

A batch is a parent entity. Each step is a durable job with its own status:
- queued
- running
- waiting_for_user
- succeeded
- failed
- cancelled
- paused

Each job must persist:
- job ID, batch ID, content ID, step type, input version/hash, provider, model
- status, progress, attempt count, idempotency key
- started/finished timestamps
- estimated cost, actual cost when known
- output asset IDs
- safe error code and short error message
- retryable flag

Do not treat an external provider call as exactly-once unless the provider offers idempotency. Before retrying, check persisted provider request ID/output state to avoid duplicate paid generation.

## Provider interfaces

```ts
interface LLMProvider {
  generateContentPlan(input: ContentPlanInput): Promise<ContentPlanResult>;
  writeScript(input: ScriptInput): Promise<ScriptResult>;
  generateScenePrompts(input: ScenePromptInput): Promise<ScenePromptResult>;
}

interface TTSProvider {
  synthesize(input: TTSInput): Promise<TTSResult>;
}

interface AlignmentProvider {
  align(input: AlignmentInput): Promise<AlignmentResult>;
}

interface VideoProvider {
  capabilities(): Promise<VideoProviderCapabilities>;
  estimateCost(input: VideoGenerationInput): Promise<CostEstimate | null>;
  generate(input: VideoGenerationInput): Promise<VideoJobResult>;
  getJobStatus(providerJobId: string): Promise<VideoJobStatus>;
}

interface AssemblyService {
  assemble(input: AssemblyManifest): Promise<AssemblyResult>;
}
```

A manual Flow workflow is a different adapter/mode:
- export prompt pack;
- record user-generated clip uploads;
- validate scene mapping;
- proceed to assembly only when required clips are present.

## Security boundaries

- Browser receives only safe public configuration and user-facing job state.
- API keys are server-only secrets.
- Provider requests happen server-side.
- RLS or equivalent authorization restricts records to the authenticated owner.
- Never save Google passwords or attempt to scrape authenticated sessions.
- Provider quota/cost claims are shown as unknown when no official data source exists.

## Deployment considerations

- Use a separate worker for FFmpeg and long tasks.
- Use object storage rather than local disk for durable assets.
- Set upload size limits and allowed MIME types.
- Generate signed download URLs for private assets.
- Keep temporary assembly files isolated and clean them up after success/failure.
- Add health checks and structured logs without tokens.
