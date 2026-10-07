# Buyer REST API v1 and webhooks

All `/v1` routes require TLS in production and `Authorization: Bearer <buyer API key>`.
Create a named key in **Account → Developer access**. Its full secret is shown once;
only its prefix and SHA-256 hash are stored. Scopes are `capabilities:read`,
`jobs:create`, `jobs:read`, `assets:create`, `assets:read`, and `webhooks:manage`.
Keys can expire, be revoked, or be rotated without changing Worker credentials.
Never put a key in a URL or log it. Rotation revokes the old key immediately.

## Routes

| Method | Route | Scope | Behavior |
| --- | --- | --- | --- |
| GET | `/v1/capabilities` | `capabilities:read` | Search published capabilities; `q`, `category`, `maximumPriceMinor`, `minimumRating`, `onlineNow`, `sort`, `limit`, `offset` use marketplace query rules. |
| GET | `/v1/capabilities/:id-or-slug` | `capabilities:read` | Current public detail, price, version and authoritative availability. |
| POST | `/v1/capabilities/:id-or-slug/jobs` | `jobs:create` | Quote, validate inputs, check availability, reserve prepaid credits and create the job through the same Core services as the web UI. |
| GET | `/v1/jobs` | `jobs:read` | Own durable job history; `limit` and `offset`. |
| GET | `/v1/jobs/:id` | `jobs:read` | Own job status, immutable input snapshot, result manifest and authorized output asset IDs. |
| POST | `/v1/jobs/:id/cancel` | `jobs:create` | Request Core cancellation and eligible credit release. |
| POST | `/v1/assets/upload-intents` | `assets:create` | Obtain a bounded direct private-storage upload intent for a capability input field. |
| POST | `/v1/assets/:id/finalize` | `assets:create` | Verify uploaded object hash, size and type before an input may be referenced. |
| GET | `/v1/assets/:id` | `assets:read` | Authenticated stream of an owned output asset. |
| GET/POST | `/v1/webhooks` | `webhooks:manage` | List/create endpoints. Secret is shown only on create. |
| PATCH/DELETE | `/v1/webhooks/:id` | `webhooks:manage` | Edit URL/subscriptions/status or remove an endpoint. |
| POST | `/v1/webhooks/:id/test` | `webhooks:manage` | Queue a signed `test.ping` event. |
| POST | `/v1/webhooks/:id/rotate-secret` | `webhooks:manage` | Rotate HMAC secret; new secret is shown once. |
| GET | `/v1/webhooks/:id/deliveries` | `webhooks:manage` | Recent status, attempts, HTTP code and sanitized error code. |

Job creation requires an `Idempotency-Key` of 8–160 characters. The key is scoped
to the buyer and endpoint and binds the canonical request fingerprint. A repeated
request returns the original response; a different request with the same key
returns `409 CONFLICT`. Persisted operation IDs recover a reservation/job after
a timeout or process crash. Reuse a key only for a retry of the same intent.
The response is runtime validated under `apiVersion: "v1"`:

```json
{
  "apiVersion": "v1",
  "jobId": "UUID",
  "status": "QUEUED",
  "capabilityId": "UUID",
  "capabilityVersion": 1,
  "price": { "currency": "USD", "amountMinor": 999 }
}
```

Request body: `{"inputs":{"question":"..."},"assets":{},"mode":"IMMEDIATE_ONLY"}`.
`mode` may be `EARLIEST_AVAILABLE`; a timezone-qualified
`latestAcceptableStartAt` may bound the wait. The server validates the
published input contract and M09 quote, then M08 reserves credits atomically.
No available credits yields `402 INSUFFICIENT_FUNDS`; no eligible capacity,
pause, or offline state yields a structured `409` availability error without a
charge. Other stable errors include `401 UNAUTHENTICATED`, `403 FORBIDDEN`,
`400 INVALID_INPUT`, `400 IDEMPOTENCY_KEY_REQUIRED`, `409 IN_PROGRESS`, and
`429 RATE_LIMITED` with `Retry-After`. Rate windows are persisted per key,
account and endpoint. For `jobs:create`, the current limits are 12/key/minute
and 30/account/minute. All money and execution transitions remain Core owned.

For a file input, create an upload intent with `capabilityId`, `fieldKey`,
`fileName`, `sizeBytes`, `sha256` (`sha256:<64 lowercase hex>`), and
`contentType`; PUT the bytes to the returned private-storage URL with the
returned headers; then finalize with `capabilityId` and `fieldKey`. Only a
verified `READY` asset owned by the buyer may enter a job. The API never uses
the Web/API local filesystem as result storage.

## Webhook delivery

Create an HTTPS endpoint with subscriptions `job.completed`, `job.failed`,
`job.cancelled` and/or `job.started`. Kivro sends only an immutable `evt_...`
ID, type, timestamp and job/capability/version/status metadata. Fetch private
results using `GET /v1/jobs/:id` and authenticated asset access. Deliveries
are **at least once**. Persist event IDs on the receiver and ignore duplicates.
A non-2xx response retries after 1 minute, 5 minutes, 30 minutes, 2 hours,
8 hours and 24 hours; after the seventh failed attempt the endpoint is disabled.
Redirect responses are failures. Delivery state and sanitized diagnostics are
visible in Account and the REST API.

Each POST has `Marketplace-Event-Id`, `Marketplace-Timestamp` (Unix seconds),
and `Marketplace-Signature` (lowercase hex HMAC-SHA256 of
`timestamp + "." + exact raw request bytes`, keyed by the endpoint secret).
Compare the signature in constant time, require timestamp freshness (five
minutes is a reasonable limit), then deduplicate the event ID. Parse JSON only
after verifying the exact raw bytes. Example Node.js receiver check:

```js
import { createHmac,timingSafeEqual } from 'node:crypto';
const timestamp=req.headers['marketplace-timestamp'];
const eventId=req.headers['marketplace-event-id'];
const supplied=req.headers['marketplace-signature'];
const rawBody=await readRawBody(req); // Buffer; do not reserialize JSON
const fresh=/^\d{10,}$/.test(timestamp) &&
  Math.abs(Date.now()/1000-Number(timestamp))<=300;
const expected=createHmac('sha256',webhookSecret)
  .update(timestamp).update('.').update(rawBody).digest();
const candidate=/^[a-f0-9]{64}$/.test(supplied)
  ?Buffer.from(supplied,'hex'):Buffer.alloc(0);
if(!fresh || candidate.length!==expected.length ||
  !timingSafeEqual(candidate,expected) || await seenEventId(eventId))
  throw new Error('Invalid or replayed Kivro webhook');
await rememberEventId(eventId); // persist with the consumer action
```

Equivalent Python check:

```python
import hashlib, hmac, time
stamp = headers["Marketplace-Timestamp"]
event_id = headers["Marketplace-Event-Id"]
signature = headers["Marketplace-Signature"]
fresh = stamp.isdecimal() and abs(time.time() - int(stamp)) <= 300
expected = hmac.new(secret.encode(), stamp.encode() + b"." + raw_body,
                    hashlib.sha256).hexdigest()
if not fresh or not hmac.compare_digest(signature, expected) or seen(event_id):
    raise ValueError("Invalid or replayed Kivro webhook")
remember(event_id)  # persist atomically with the consumer action
```

The cloud dispatcher validates every DNS answer as public, pins the selected
address for a direct TLS connection, validates the original hostname's
certificate, refuses redirects and caps response bytes/time. Seller Workers
never deliver buyer webhooks. Run `pnpm webhook:dispatch` in local development;
the cloud-only `POST /api/internal/webhooks/dispatch` can be invoked by a
supervised deployment cron with `KIVRO_WEBHOOK_CRON_SECRET`. Configure durable
key material consistently across Web/API and dispatcher instances. Production
requires `KIVRO_WEBHOOK_BLOCKED_HOSTS` containing every current and draining
control-plane/discovery hostname; `APP_ORIGIN` and `WORKER_DISCOVERY_URL` are
also denied automatically. Registration and each retry validate DNS again.
