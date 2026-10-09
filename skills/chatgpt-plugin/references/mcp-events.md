# MCP Events

Use this for a user's request to monitor application updates and act when a matching event arrives. ChatGPT creates the subscription and supplies a callback URL/signing secret. Events do not give an app unrestricted authority to start conversations or define new instructions. Keep the user's monitoring goal, permitted actions and stop condition in the behavior contract.

This is separate from resource subscriptions that refresh an open viewer, UI messages sent after a user action, plugin lifecycle hooks and internal application events.

## Protocol and ownership

Require MCP 2.0 protocol 2026-07-28. Advertise events in server/discover and implement events/list, events/subscribe and events/unsubscribe on the same authenticated endpoint as tools. Check [SDK compatibility](compatibility.md); @openai/mcp-extensions is not an event delivery framework. ChatGPT currently supports webhook delivery and callback verification, not polling, streaming or gap/terminated notifications.

Define stable names, bounded payload schemas, filter input schemas and pagination when needed. Expose only events the principal can discover. Validate resource filters and account permissions before subscribing and recheck access before delivery. Send summaries with IDs and a read tool for large records. User-authored payload text is data, not agent instructions.

Persist owner, canonical filter arguments, event name, callback URL, signing secret, expiry and replay state. Derive subscription identity from owner/name/arguments/callback; repeating subscribe refreshes it. Honor finite TTL/defaults, grant infinity only deliberately, and expire deliveries. Keep unsubscribe idempotent and account-scoped. Canonical JSON prevents key order from creating duplicate subscriptions.

## Callback and delivery

Verify callbacks before sending application data. Require HTTPS, validate every resolved destination at connection time, block non-public addresses including mapped IPv6, preserve hostname TLS verification and never follow redirects. Checking the URL once then using a fresh unvalidated fetch leaves a DNS-rebinding hole. Apply this to verification and delivery.

Validate whsec_ secrets decoding to 24–64 bytes. Use Standard Webhooks with a single serialization of the body, unique webhook-id, signing timestamp, signature and X-MCP-Subscription-Id. Verification uses a fresh short-lived one-use challenge; require 2xx and a constant-time matching echo. Keep secrets out of logs/evidence and protect them in storage.

Send one event per request with no more than 256 KiB total body. Persist unique event IDs across retries. A 2xx acknowledges receipt; processing is asynchronous. Retry transient failures with exponential backoff, fresh signatures and bounded attempts. Do not retry 410 or 413. Account for out-of-order delivery, batching, duplicate effects and signing-key rotation. A replay cursor must not advance past pending deliveries; declare cursor:null if history cannot be recovered.

Use a transactional outbox or the project's existing durable job system when a committed mutation must produce an event. Tie queue entries to subscriptions so expiry, unsubscribe or revoked access prevents retries too. Make write tools idempotent and stop event/action feedback loops. Don't bolt an in-memory timer onto a serverless endpoint and call it durable delivery.

## Proof

Directly exercise list, canonical identity, repeat subscribe, wrong-owner denial, verification failure, expiration, refresh/restart, rotation, unsubscribe, filtering, retries and signature verification. Test private callback rejection and payload bounds. A local callback receiver supports those protocol claims.

In ChatGPT separately observe discovery, user-authorized subscribe, callback verification, matching event, intended agent response, independent read of any mutation and stop monitoring. Exercise nonmatching events and access revocation. Record host/model/account, subscription identity without secrets, server revision and result. Do not infer task completion from webhook acceptance.

Source checked 2026-09-30: [MCP Events integration](https://developers.openai.com/plugins/build/mcp-events). Production needs the project's transactional storage, authorization and queue.
