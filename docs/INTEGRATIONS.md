# Integrations and provider strategy

## General rule
Build adapters, not provider-specific business logic in UI components. Verify current official documentation and account access before implementing an external integration. Do not simulate success.

## 1. LLM/content planning
Purpose:
- propose new topics based on stored content history;
- verify claims using research sources where browsing/research is available;
- write narration and metadata;
- generate scene prompts.

Requirements:
- Store provider/model and run metadata.
- Require structured output validated against a schema.
- Store source URLs with factual claims.
- If sources are missing or uncertain, mark `needs_verification`.
- Deduplicate against previous titles/topics/angles.
- Never overwrite prior rows by default.

Implementation:
- Use a server-side LLM adapter with JSON/schema validation.
- Support a mock provider for local development and tests.

## 2. ElevenLabs TTS
Preferred flow:
1. Send approved narration to a timestamp-capable TTS endpoint where available.
2. Store MP3/audio output.
3. Store character/word alignment metadata.
4. Convert alignment to natural scene segments.
5. Record provider/model/voice ID and available usage metadata.

Fallback:
- User uploads MP3.
- Run a supported alignment provider or import alignment JSON.
- If only estimated timestamps are available, visibly label them ESTIMATED.

Do not assume free-plan credits from multiple accounts can be read or controlled by the app. Do not store passwords or automate account switching.

## 3. Google Flow
MVP mode: semi-manual.
- Export a prompt pack containing scene ID, prompt, duration target, narration segment, and continuity notes.
- Provide a numbered checklist and expected filenames.
- User generates clips through the supported Flow UI.
- User uploads multiple clips back to the app.
- Match clips by filename or user mapping.
- Validate missing/duplicate scene files.
- Continue to assembly when all required clips are present.

Do not claim direct Flow API generation unless official, supported API access has been verified for the user's account and use case. Do not implement automated Google login rotation or quota evasion.

## 4. Alternative video-generation API
Build a VideoProvider adapter so a documented API provider can be selected later. Before enabling:
- confirm current model availability and region/account access;
- verify portrait aspect ratio and duration options;
- check input/output reference support for continuity;
- record cost units and rate limits;
- test with a single scene;
- verify rights/terms and content policy;
- show cost estimate before paid generation.

Do not assume Gemini API uses Google Flow subscription credits. Treat API billing and Flow credits as separate unless official documentation explicitly says otherwise.

## 5. FFmpeg assembly
- Worker downloads/copies required assets to temporary workspace.
- Validate all expected scene clips are present.
- Normalize video streams to a common codec, frame size, frame rate, and pixel format.
- Concatenate in scene order.
- Mix or replace audio according to project settings; default narration is primary.
- Pad or trim the final video carefully to match the intended audio duration.
- Do not speed up narration by default.
- Export H.264 MP4, AAC audio, 9:16, default 1080x1920.
- Save assembly manifest and log.
- Clean temporary files after job completion.
- Include automated tests for ordering and missing clips.

## 6. Social platforms
MVP:
- No direct publishing API.
- Export one clean master MP4 and platform-specific title/caption/hashtags.
- Provide a manual checklist for TikTok, YouTube Studio, and Meta Business Suite.
- Store manual status and publication URL if the user records it.

Future:
- Investigate official publishing APIs, eligibility, permissions, review requirements, and limits separately for each platform.
- Never state that a post is scheduled or published unless the platform confirms it.

## 7. Cost ledger
For every external generation:
- estimate before starting if possible;
- reserve budget before paid calls;
- record actual provider-reported usage where available;
- otherwise mark usage as estimated or manually entered;
- do not fabricate balances;
- stop or request confirmation if costs are unknown and the configured budget requires it.

## 8. Testing integrations
For each provider:
1. unit tests with mocks;
2. configuration validation;
3. explicit “Test connection” action;
4. one low-cost test generation only after user confirmation;
5. verify result can be downloaded and persisted;
6. document limitations and failure modes.
