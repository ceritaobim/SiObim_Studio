# Acceptance Criteria and Test Checklist

## Global
- [ ] Responsive at 360px, 390px, tablet, desktop.
- [ ] Indonesian UI and timezone configurable.
- [ ] No secrets in frontend bundle or logs.
- [ ] Loading, empty, success, and error states exist.
- [ ] Database-backed state survives reload and device changes.
- [ ] Background jobs continue after browser closes.

## Content planning
- [ ] New batch uses existing content library.
- [ ] New plan does not overwrite existing records.
- [ ] Similar topic/angle triggers a warning.
- [ ] Each factual claim can carry source URL(s).
- [ ] Unverified claims are visibly marked.
- [ ] XLSX export opens correctly and has stable column names.
- [ ] XLSX import reports errors and duplicates before committing.

## Audio and timestamp
- [ ] MP3 upload works.
- [ ] TTS adapter returns persisted audio asset.
- [ ] Alignment spans are ordered and validated.
- [ ] Text coverage can be checked against original narration.
- [ ] Estimated timestamps are never labeled actual.
- [ ] Scene boundaries prefer sentence/clause boundaries.

## Scene prompts and clips
- [ ] Character/style settings are reused without re-entry.
- [ ] Scene IDs and filenames are stable.
- [ ] Prompt pack export contains every scene.
- [ ] Multi-file upload maps files to expected scenes.
- [ ] Missing and duplicate scene clips are detected.
- [ ] Unsupported Flow API is not represented as connected.

## Budget and jobs
- [ ] Cost estimate appears before batch start where possible.
- [ ] Unknown costs are explicitly labeled.
- [ ] Budget guard prevents work beyond configured cap.
- [ ] Failed step can be retried without restarting completed steps.
- [ ] Provider request IDs and safe errors are recorded.
- [ ] Retry policy cannot cause unbounded paid generations.

## Assembly
- [ ] Scene order is correct.
- [ ] Missing clips block assembly.
- [ ] Final video is MP4, vertical 9:16, expected resolution.
- [ ] Narration is present and audible.
- [ ] Final duration mismatch is reported.
- [ ] No subtitles/watermark are added by default.
- [ ] Assembly report and output asset are persisted.

## Publishing
- [ ] One video has metadata for TikTok, YouTube, Instagram.
- [ ] Captions can be copied separately.
- [ ] Master MP4 can be downloaded.
- [ ] App never marks content published without confirmation.
- [ ] Planned publication dates are timezone-aware.
