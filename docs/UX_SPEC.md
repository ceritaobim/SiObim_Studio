# UX Specification

## Design direction
- Clean, calm, utility-first production dashboard.
- Mobile-first responsive layout.
- Indonesian interface by default.
- Clear status labels and next actions.
- Avoid dense desktop tables on phone; use cards or horizontally scrollable tables.
- Use accessible contrast, visible focus, labels, and confirmation for destructive actions.

## Navigation
Desktop sidebar:
1. Dashboard
2. Content Library
3. Weekly Batches
4. Production Queue
5. Assets
6. Publishing
7. Settings

Mobile bottom navigation or compact menu:
- Home
- Content
- Production
- Publish
- More

## Screen 1: Dashboard
Show:
- current batch and progress;
- videos ready, in production, blocked, failed;
- next approval required;
- budget consumed/estimated;
- latest errors;
- button “Mulai batch mingguan”;
- button “Lanjutkan produksi”.

## Screen 2: Content Library
- Search, category/status filters.
- List/cards with content code, title, target duration, verification status, production status.
- Content detail includes script, sources, voice, scenes, assets, and publications.
- Import XLSX and export selected/all rows.
- Duplicate-topic warning with explanation.

## Screen 3: Weekly Batch Wizard
Steps:
1. Choose week and target count (pre-filled from settings).
2. Show estimated cost/required integrations.
3. Generate planning.
4. Review topics and facts.
5. Approve scripts.
6. Start production.
User should not have to re-enter the visual guide or prompt templates each week.

## Screen 4: Production Queue
- List jobs with state, progress, provider, cost estimate, attempts, and last error.
- Filters: queued/running/waiting/failed/completed.
- Actions: pause, resume, retry failed step, cancel when safe.
- Explain why a job is blocked.
- Retry only the failed step.

## Screen 5: Scene Editor
- Ordered scene cards.
- Start/end timestamps, narration segment, visual action, prompt, status.
- Copy prompt; export prompt pack.
- Upload/replace scene clip.
- Display continuity reference and previous scene.
- Flag estimated timestamps.

## Screen 6: Assets and Assembly
- Upload multiple clips from mobile or desktop.
- Map filenames to scenes.
- Show missing/duplicate clips.
- Preview voice-over and scene clip.
- Assemble button enabled only when required assets exist.
- Display final MP4 preview, duration, aspect ratio, audio status, and validation report.

## Screen 7: Publishing Center
- One card per content and platform.
- Platform-specific title/caption/hashtags.
- Copy caption button.
- Download master MP4.
- Checklist for manual upload.
- Planned publish date/time, status, published URL.
- No false “published” status without confirmation.

## Screen 8: Settings
Sections:
- Channel and language.
- Content style and factual standards.
- Visual identity and character references.
- Duration and scene timing.
- Provider configuration and connection test.
- Budget caps and retry policy.
- Platform targets.
- Data export and account settings.

## Responsive requirements
- Must work at 360px, 390px, tablet, and desktop.
- Primary actions must not require hover.
- Upload controls must work with mobile file picker.
- Long tasks continue after navigation away.
- Avoid giant spreadsheet-like views on mobile.
- Confirm before deleting assets/content or spending above configured threshold.
