# Security and Privacy Requirements

- Authentication required for all private pages and APIs.
- Every database query must be scoped to the authenticated owner.
- Use row-level security where supported.
- API keys are stored only in deployment secrets or a proper secret manager.
- Never store Google passwords, browser cookies, or raw OAuth tokens in plaintext.
- If OAuth is added later, use the provider's supported flow and encrypted token storage.
- Never log full prompts if they contain private information or credentials.
- Sanitize filenames and validate uploaded MIME type, size, and duration.
- Store media in private object storage and use short-lived signed URLs for downloads.
- Validate all API request bodies server-side.
- Add rate limits to expensive generation endpoints.
- Require confirmation before destructive deletion or large-cost generation.
- Keep an audit trail for budget changes, provider configuration, and job retries.
- Provide export and delete-data controls for the owner.
- Do not use account rotation or session automation to bypass provider quotas.
