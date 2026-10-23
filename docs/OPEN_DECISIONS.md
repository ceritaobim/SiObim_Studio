# Open Decisions — Do Not Guess

These items require verification or owner choice before final production deployment.

1. **Video generation provider**
   - MVP: semi-manual Google Flow.
   - Future: choose a documented video-generation API after verifying cost, portrait format, duration, reference-image/video support, region, and terms.
   - Do not assume Flow credits and API billing are interchangeable.

2. **LLM provider**
   - Select provider and model based on current access, cost, structured output, and research capability.
   - Keep provider adapter replaceable.

3. **TTS**
   - Verify the user's ElevenLabs account/API access and timestamp-capable endpoint/model.
   - Keep MP3 upload as fallback.

4. **Job runner and hosting**
   - Choose hosting that supports durable background jobs and FFmpeg worker execution.
   - Do not run long video processing inside a short-lived web request.

5. **Cost units**
   - Store costs in native provider units and optionally normalized currency.
   - Only label actual when returned by provider; otherwise estimated/manual.

6. **Publishing**
   - MVP upload remains manual.
   - Any later direct publishing requires official API access and permissions.

7. **Content schedule**
   - Initial planning target is a configurable batch, with a conservative default of two monetization-oriented videos per week until real production costs and time are measured.
   - The owner may change this in settings.

8. **Monetization**
   - Do not promise eligibility or earnings based on duration alone. Platform rules and account eligibility can change.
