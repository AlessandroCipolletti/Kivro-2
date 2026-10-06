# Security Evidence Matrix

Maintain a live Threat → Control → Test → Evidence matrix derived from
the Master Spec. Required categories include sandbox escape/private
seller data, malicious seller handling of buyer data, skill/supply
chain, SSRF/private networks, credentials, arbitrary proxy abuse,
payment replay/double settlement, cross-control-plane routing, asset
path/special-file attacks, webhook forgery and Worker version
compromise/revocation.

Security claims without test/review evidence remain incomplete.

## Current M04 offline sandbox evidence (2026-10-06)

| Threat | Enforced control | Executed evidence | Remaining mandatory gate |
| --- | --- | --- | --- |
| Host file, personal OpenClaw, SSH/browser profile and Docker socket access | Digest-pinned container; only a private per-attempt input directory is bound read-only; no personal host path or Docker socket mount | `pnpm test:sandbox:docker` checks an unmounted host sentinel and personal OpenClaw/socket paths; adapter verifies the sole effective bind | Repeat with the pinned OpenClaw image and hostile buyer payload, skill, and real Worker job at M07; M05 must validate input staging and output collection. |
| Arbitrary network/proxy use | `network=none`; effective container inspection before start | Docker canary fails an outbound IP request; policy rejects network/inference without broker | M06 SSRF/DNS/redirect/IPv4/IPv6/broker tests and M07 OpenClaw execution; no networked capability may run meanwhile. |
| Privilege, root writes and resource exhaustion | Non-root UID/GID, read-only root, all capabilities dropped, no-new-privileges, seccomp, fixed memory/CPU/PID limits, runtime/output caps | Docker canary confirms UID/GID 65532, zero CapEff, NoNewPrivs, root/input write denial, timeout and cleanup; adapter compares actual Docker config before start | M07 descendant/process-group OpenClaw timeout tests, M05 output size/file attacks, pinned-image vulnerability review, platform-specific isolation review. |
| Missing sandbox prerequisite | No host execution fallback; unavailable Docker or approved image stops before create/start | Docker canary verifies missing executable and missing digest return structured errors; changed image is rejected | Connect admission/Worker doctor/paid dispatch at M07 and verify no reservation can run on failure. |

This is evidence for the **offline canary profile only**. It does not prove that OpenClaw's own sandbox wiring, seller resource brokers, payment, a buyer job, or a production host is secure. The Alpine fixture is not an approved Kivro OpenClaw execution image.

## Current M06 broker evidence (2026-10-06)

| Threat | Current enforced component and executed evidence | Remaining mandatory gate |
| --- | --- | --- |
| SSRF, seller LAN, metadata, encoded IP, DNS rebinding and private redirects | Shared URL/IP classifier, per-hop DNS validation and vetted-IP pinned Node HTTP/TLS transport; `tests/research-broker.test.mjs` covers blocked forms/mixed answers/redirects, `pnpm test:research:live` fetched only `https://example.com/` (200, 577 bytes). | M07 authenticated OpenClaw tool route and M19 both deployed roots must prove no unmediated socket. |
| Generic POST, proxy abuse and downloaded script execution | Research broker admits only GET/HEAD on public 80/443, bounded MIME/bytes/redirects and opaque hashed downloads. Unit red-team and the rerun `pnpm test:sandbox:docker` pass. | M07 noexec untrusted download workspace and M16 hostile-model payloads must prove no package install/action/exfiltration. |
| Runaway cost, duplicate requests and replay | PostgreSQL migration 0013 and adapters lock job rows, reserve bytes/spend, enforce query/page/download/request and cross-job rate ceilings, and preserve sanitized rows. `pnpm test:postgres:m06` passes concurrent budget and duplicate-ID cases. | M07 real job/version/payment binding, M26 crash/reconnect tests, live provider pricing and M08/M33 seller economics. These rows are usage evidence, not financial ledger truth. |
| Seller DB and provider credentials | Named read-only SELECT with declared columns, fixed row scope, bounded rows/timeout, dedicated nonprivileged role and no raw SQL API; typed declared API/provider brokers inject credentials only in adapter code. PostgreSQL and unit tests pass denied sibling table, write, superuser and key-echo cases. | M07 real Worker/OpenClaw tool binding, credential revocation and secret isolation; M16 combined research/private-data exfiltration tests. |

These tests verify broker components, not the complete paid-job security boundary. No M06 or previously deferred cross-system gate is marked `VERIFIED` from them alone.

## Current M05 asset-boundary evidence (2026-10-06)

| Threat | Current control/evidence | Remaining mandatory gate |
| --- | --- | --- |
| Guessed asset ID or cross-buyer grant | Pure access decision requires owner or exact target-job/active assigned Worker grant with secured payment; migration 0010 rejects source-owner mismatch, cross-buyer grant, identity/hash rewrite and grant restoration. `pnpm test:postgres:m05` and `tests/assets.test.mjs` pass. | M07 authenticated service must fetch actor/job/grant itself; M10/M13 cross-account API/browser tests and both-provider conformance. |
| Public object exposure or forged direct upload | S3 adapter uses private keys and 30–900 second signed URLs; local MinIO and pinned SeaweedFS integrations prove anonymous GET denial and checksum-bound direct PUT. Local Compose generates an explicit private identity and checks anonymous denial before use. | Deployment bucket policy, auth-before-signing, URL expiry/reissue and production S3-compatible endpoint conformance. |
| Missing, truncated or corrupt result object | Shared `verifyStoredObject` hashes streamed bytes; fake metadata cannot authorize READY. Unit tests cover missing/size/hash/cap failures. | M07 finalization transaction and M26 fault injection around object upload, DB commit, duplicate completion, cleanup and process restart. |
| Output path traversal and special files | Stopped-attempt collector rejects traversal, symlinks, hardlinks, non-regular paths, paired MIME/extension mismatch and byte ceilings. Bounded Docker tar transfer from a read-only collector rejects links/traversal/sparse oversized entries; real Docker cleanup test passes. | M07 hostile OpenClaw job and descendant handling; archive/active-content policy and durable authenticated result retrieval. |

## Current M07 pinned OpenClaw execution evidence (2026-10-06)

| Threat | Enforced M07 control | Executed evidence | Remaining mandatory gate |
| --- | --- | --- | --- |
| Missing/changed image or ineffective OpenClaw sandbox | Private 0600 image approval binds digest, source hash, version and complete Docker conformance; the runner checks OpenClaw's effective mode-all contained backend, empty workspace mounts, exact tool list and disabled elevation before `agent exec` | `pnpm openclaw:approve-local-image`; `tests/openclaw-image-approval.test.mjs`; `tests/docker-openclaw-exec-local-integration.mjs` rejects disabled/foreign sandbox | M16 paid deployed route and M19 both profile roots must still fail closed on missing approval/Docker. |
| Seller host file, personal OpenClaw state or private network access | Only the private job input bind is read-only; root is read-only, UID 65532, `network=none`, no Docker socket, fixed HOME/state; broker routes only selected tools | Real pinned OpenClaw job and same-container unmounted host sentinel/metadata-IP denial in `tests/docker-openclaw-exec-local-integration.mjs`; effective policy and selected skill hash unit tests | M16 hostile published skill/plugin and seeded personal-session E2E; M19 provider parity. |
| Credential exposure, arbitrary provider/tool call and unbounded spend | Seller key remains in the Worker completion broker, model transcript and tool names are validated, M06 usage reservations bound by job/version, sidecar authorizes around each call | `tests/openclaw-completion-broker.test.mjs`, `tests/worker-broker-router.test.mjs`, `tests/docker-broker-sidecar-local-integration.mjs`, real OpenClaw file-tool/inference tests | M08 ledger, M16 live seller-provider/paid hostile job, M26 replay/cost fault tests and M33 cost-policy product gate. |
| Pause acknowledged while provider call continues | Transactional local broker barrier and abortable sidecar quiesce before Docker whole-container PAUSED; duplicate commands have durable IDs/audit | `tests/docker-worker-supervisor-local-integration.mjs` pauses an actual in-flight OpenClaw inference and proves no new calls while PAUSED; `tests/worker-job-control.test.mjs` | M13 live command route; M16 seller UI paid pause; M26/M29 crash, restart and lost-ACK recovery. |
| Forged Worker output or duplicate finalization | Input manifest/hash/contract rechecked after authenticated acceptance; output collector validates schema/path/MIME/size; private upload and SQLite outbox precede cloud finalization | `tests/m07-result-postgres-integration.mjs`, `tests/docker-worker-supervisor-local-integration.mjs` (lost finalization ACK retry without rerun), `pnpm test:output:storage` | M08 financial truth, M13 authenticated endpoints, M16 full paid file E2E, M26 commit/cleanup fault injection. |

The M07 local conformance approval applies to one pinned OpenClaw version and one local image digest. It is implementation evidence, not a deployed paid-job or both-provider acceptance result. `DEC-IMPL-012` records why the approved OpenClaw backend is the already-inspected per-job container.

## Durable result security evidence

Evidence must cover cross-buyer and cross-seller denial, anonymous
denial, short-lived URL expiry, private-bucket direct-object denial,
cleanup race safety, incomplete/malicious Worker completion blocked by
finalization, and missing/corrupt output detection.

## Buyer Experience privacy/security evidence

Prove Worker payload minimization; no payment/email/profile leakage;
privacy disclosure matches serialized job payload; preview
isolation/sanitization; bulk-download traversal defense; result
authorization; problem-report evidence isolation; reliability
aggregation contains no buyer-private fields.

## Seller Experience security evidence

Prove discovery does not expose resources; AI draft cannot authorize;
effective visual permissions equal machine manifest; secrets remain
local/redacted; Worker payload minimizes buyer identity; diagnostics are
sanitized; provider spend guardrails are buyer-proof; rollback cannot
reactivate security-incompatible version; public marketplace identity
does not leak KYC identity; multi-Worker routing preserves isolation.
