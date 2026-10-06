# Work and activity names

Give explicit Work groups and captured Codex turns readable, cached headings using
the owner's ChatGPT subscription and `gpt-6-luna`. Names describe requested work;
they do not infer grouping, PR membership, completion or success.

## Acceptance

- A turn with captured, redacted user-request text receives one activity name.
  Work without an explicit label receives one heading from up to four related
  requests, including requests from different native conversations. Explicit
  labels win. Pending, missing or failed naming preserves the current fallback.
- Names are durable projections. Polling, replay, pagination and page loads do
  not trigger model calls. Small batches share a single model call. Work waits
  briefly for related requests, and names remain stable after generation.
- A separate, owner-authenticated worker runs ephemeral Codex executions in an
  empty directory, ignores project/user configuration and uses the saved ChatGPT
  login. Collector capture and delivery never await inference. No API key or
  Vercel gateway is required. Failures retry with backoff; abandoned work expires.
- Only enrolled, enabled projects with captured request content are eligible.
  Machine ingestion credentials cannot claim prompts or publish names. Claims
  and completion recheck project, membership and source revision. Historical
  backfill is bounded and resumable. Metadata-only records keep their fallback.
- Work, activity lists and detail pages use the same generated names while
  retaining source identifiers. An explicit Work name on any loaded group member
  takes precedence over generated text.

## Proof choices

No Pencil work: this changes text within existing layouts, without a visual
composition decision. Storybook covers generated and fallback names together,
plus Work label precedence. Backend tests cover caching, authorization, changed
sources, project boundaries and retries. Worker tests cover structured output,
timeouts and cancellation. A synthetic live Luna call verifies subscription
access; browser tests verify the named UI. Production installation on Otis is a
separate operational step, not implied by local proof.
