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

## Current M05 asset-boundary evidence (2026-10-06)

| Threat | Current control/evidence | Remaining mandatory gate |
| --- | --- | --- |
| Guessed asset ID or cross-buyer grant | Pure access decision requires owner or exact target-job/active assigned Worker grant with secured payment; migration 0010 rejects source-owner mismatch, cross-buyer grant, identity/hash rewrite and grant restoration. `pnpm test:postgres:m05` and `tests/assets.test.mjs` pass. | M07 authenticated service must fetch actor/job/grant itself; M10/M13 cross-account API/browser tests and both-provider conformance. |
| Public object exposure or forged direct upload | S3 adapter uses private keys and 30–900 second signed URLs; local MinIO and pinned SeaweedFS integrations prove anonymous GET denial and checksum-bound direct PUT. Local Compose generates an explicit private identity and checks anonymous denial before use. | Deployment bucket policy, auth-before-signing, URL expiry/reissue and production S3-compatible endpoint conformance. |
| Missing, truncated or corrupt result object | Shared `verifyStoredObject` hashes streamed bytes; fake metadata cannot authorize READY. Unit tests cover missing/size/hash/cap failures. | M07 finalization transaction and M26 fault injection around object upload, DB commit, duplicate completion, cleanup and process restart. |
| Output path traversal and special files | Stopped-attempt collector rejects traversal, symlinks, hardlinks, non-regular paths, paired MIME/extension mismatch and byte ceilings. Bounded Docker tar transfer from a read-only collector rejects links/traversal/sparse oversized entries; real Docker cleanup test passes. | M07 hostile OpenClaw job and descendant handling; archive/active-content policy and durable authenticated result retrieval. |

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
