# Agent Instructions — CeritaObim Studio

## Product context
Build a mobile-first web application that helps one creator batch-produce AI-assisted Indonesian short-form fact videos for TikTok, YouTube Shorts, and Instagram Reels. The owner has only one free day per week and wants recurring production with minimal repeated manual input.

## Required behavior
- Read `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/INTEGRATIONS.md`, and `docs/IMPLEMENTATION_PLAN.md` before implementing features.
- Follow the implementation milestones in order. Do not build the whole system in one pass.
- At the start of a milestone, state scope, assumptions, files to change, and tests.
- At the end, summarize changes, commands/tests run, results, remaining limitations, and the next milestone.
- Keep business logic out of UI components.
- Use typed schemas for all API inputs/outputs and validate server-side.
- Make long-running work asynchronous using a durable job queue/worker.
- Persist job state and progress to the database.
- Make job steps idempotent so retries do not duplicate paid AI calls or lose completed work.
- Store provider/model, request ID, estimated cost, actual cost if available, timestamps, retry count, and error summary for each generation.
- Never expose secrets in browser bundles, logs, or error messages.
- Never hardcode API keys or credentials.
- Use adapters/interfaces for LLM, TTS, alignment, video generation, and storage providers.
- If a provider integration is unavailable or undocumented, implement a mock/stub and a clear manual workflow; do not fake a successful integration.
- Do not implement automated switching among personal Google accounts to bypass quotas. Respect provider terms and official limits.
- MVP publishing is manual. Build export-ready files, captions, and a publication checklist rather than pretending to publish automatically.
- Preserve all existing content when generating a new content plan.
- Keep content in Indonesian by default.
- Keep the visual identity: handmade origami paper stop-motion; every character, object, prop, and background appears made of folded paper; no realistic people/objects; no subtitles in generated video.
- Default content target is approximately 65–80 seconds for monetization-oriented content, but allow per-video duration settings and shorter experiments.
- Do not assert monetization eligibility based on duration alone.
- UI must work at 360px mobile width and desktop widths; support keyboard accessibility and loading/error/empty states.
- Prefer a simple, maintainable MVP over premature complexity.

## Recommended stack
Follow `docs/ARCHITECTURE.md`. If a dependency or service is not available, explain before substituting it.

## Coding standards
- TypeScript strict mode.
- Small components and focused modules.
- Server-side validation.
- Clear error handling.
- Tests for cost calculations, job transitions, scene timestamp validation, and export assembly metadata.
- No destructive migrations without explicit review.
- Add/update documentation when behavior changes.
- Use `.env.example`; never commit `.env.local`.

## Definition of done
A feature is done only when:
1. It matches the PRD.
2. It has loading, empty, success, and error states where relevant.
3. It is responsive.
4. Validation and authorization happen server-side.
5. Tests and lint/typecheck pass, or blockers are clearly documented.
6. It does not claim unsupported provider capabilities.
