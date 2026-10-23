# Implementation Plan

Implement one milestone at a time. Do not skip ahead until acceptance criteria pass.

## Milestone 0 — Repository and UI foundation
Deliver:
- scaffold Next.js + TypeScript strict mode;
- Tailwind and accessible component library;
- lint, typecheck, test scripts;
- responsive app shell and navigation;
- placeholder dashboard, content, batches, production, publishing, settings pages;
- `.env.example`;
- deployment and local setup README.

Exit criteria:
- app runs locally;
- lint/typecheck pass;
- 360px mobile layout is usable;
- no provider integration is falsely represented as connected.

## Milestone 1 — Auth, database, settings, content library
Deliver:
- auth and owner-only access;
- database migrations;
- project settings;
- content CRUD and statuses;
- XLSX import/export;
- seed/demo data clearly labeled.

Exit criteria:
- data persists across refresh/devices;
- import does not overwrite existing content silently;
- RLS/authorization tests pass.

## Milestone 2 — Weekly content planning
Deliver:
- LLM provider interface and mock;
- structured planning schema;
- previous-content context and duplicate warning;
- source URL fields and verification status;
- approval/edit/regenerate workflow;
- batch creation.

Exit criteria:
- new planning appends new content;
- invalid structured output is rejected or repaired safely;
- missing sources are marked for verification;
- provider failures are visible.

## Milestone 3 — Voice and timestamp pipeline
Deliver:
- TTS adapter interface;
- manual MP3 upload fallback;
- alignment import/adapter;
- scene segmentation algorithm;
- coverage/order validation;
- audio asset storage.

Exit criteria:
- no narration text is lost or duplicated in segmentation;
- actual vs estimated timestamps are clearly labeled;
- audio and alignment persist across sessions.

## Milestone 4 — Scene prompts and semi-manual Flow
Deliver:
- reusable style/character settings;
- prompt generation;
- prompt pack export as TXT/CSV/XLSX;
- scene checklist;
- multi-file clip upload and scene mapping.

Exit criteria:
- each scene has stable ID and prompt;
- missing/duplicate clips are detected;
- no unsupported Flow API claim appears.

## Milestone 5 — Durable queue, budget ledger, and assembly
Deliver:
- durable job runner;
- job state/progress UI;
- retries, pause/resume where safe;
- cost estimates/ledger and budget guard;
- FFmpeg worker;
- final MP4 validation and preview.

Exit criteria:
- closing browser does not stop worker jobs;
- retrying a failed assembly does not repeat paid AI calls;
- missing clips block assembly;
- output metadata and report are saved.

## Milestone 6 — Publishing center and PWA polish
Deliver:
- three platform metadata records;
- manual publishing checklist;
- publish status and URL tracking;
- responsive polish and PWA manifest/icons;
- export full project data.

Exit criteria:
- one master MP4 can be paired with three platform-specific metadata sets;
- app works on phone and desktop;
- PWA installation works in supported browsers.

## Milestone 7 — Optional direct video API
Only after a provider is selected and official access, pricing, capabilities, and terms are verified.
Deliver:
- real video provider adapter;
- cost preview;
- low-cost test flow;
- generation status and result ingestion;
- failure/retry behavior.

Exit criteria:
- real generation is verified end-to-end;
- cost and limits are documented;
- no account-rotation workaround is required.

## Suggested Antigravity task protocol
For every milestone, ask the agent to:
1. inspect current repository and relevant docs;
2. propose a short implementation plan;
3. list files/migrations to change;
4. implement only that milestone;
5. run tests/lint/typecheck;
6. inspect mobile UI;
7. summarize results and blockers;
8. stop and wait before the next milestone.
