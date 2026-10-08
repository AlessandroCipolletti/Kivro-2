# M16 local security checklist — 2026-10-07

This is local engineering evidence for Master Spec §§34, 44, 45 and 91. It is
not a public-onboarding approval or an external red-team attestation. Commands
were run against Docker Engine with the pinned OpenClaw runtime; the installed
paid-job probe is in `tests/m16-installed-worker-e2e.mjs`.

| Required control | Executable evidence | Current result |
| --- | --- | --- |
| Personal OpenClaw workspace/config and arbitrary seller host files unavailable | `tests/docker-sandbox-local-integration.mjs`, `tests/docker-openclaw-exec-local-integration.mjs`, live paid sandbox probe in `tests/m16-installed-worker-e2e.mjs` | Technical mount denial passed; quiesced personal-state non-mutation proof remains open under `PRD-0010`, `WRK-0015`, `WRK-0016`. |
| Docker socket, privilege escalation and forbidden tools unavailable | `tests/docker-sandbox-local-integration.mjs`, `tests/docker-openclaw-exec-local-integration.mjs`, `tests/worker-broker-router.test.mjs`, live paid probe | Passed. |
| Public Internet, localhost, seller LAN and metadata denied by the sandbox | `tests/docker-sandbox-local-integration.mjs`, live paid probe | Passed for the actual paid-job container; declared host broker ports are separately allowlisted. |
| Worker credentials and seller resource secrets kept outside the sandbox | `tests/m12-seller-vault.test.mjs`, `tests/worker-resource-ports.test.mjs`, live paid probe | Passed for local boundaries; external public-beta review remains open. |
| Database permissions and undeclared operation denial | `pnpm test:resource:e2e`, `tests/m06-postgres-integration.mjs` | Dedicated PostgreSQL role allows one scoped SELECT; private table, writes and an undeclared operation fail. The real Docker/OpenClaw fixture reaches only the approved Worker broker. |
| Timeout/process tree, PID, CPU/memory ceilings and no host fallback | `tests/docker-controlled-execution-local-integration.mjs`, `tests/docker-sandbox-resources-local-integration.mjs`, `tests/docker-sandbox-local-integration.mjs`, `tests/m16-installed-worker-e2e.mjs` | Timeout termination, cgroup PID denial, cgroup memory kill, missing-image and missing-Docker refusal passed. The installed paid runaway-model job stopped within the eight-request seller guardrail, released credits and left no container or staged input. |
| Input/output traversal, symlink and archive policy | `tests/output-transfer.test.mjs`, `tests/docker-sandbox-output-local-integration.mjs`, `tests/io-readiness.test.mjs`, `tests/sql/m05_assets.sql` | Passed at parser, Docker collection and private asset boundaries. |
| Output size and token/provider cost ceilings | `tests/docker-sandbox-output-local-integration.mjs`, `tests/m06-postgres-integration.mjs`, `tests/local-inference-runtime.test.mjs` | Oversized sparse output and over-budget provider/local model calls fail closed. |
| Malware scan before settlement | `tests/m16-installed-worker-e2e.mjs`, `tests/m15-clamav-live.test.mjs`, `tests/m15-result-safety.test.mjs` | The paid file-result path passed with the actual local ClamAV service. A live EICAR result was rejected with credit release and no manifest or seller earning. A simulated scanner outage retained an unsettled durable outbox until clean restart/replay. |
| Duplicate offer, message, completion and financial settlement | `tests/m07-postgres-integration.mjs`, `tests/m08-finance-postgres-integration.mjs`, `tests/m16-installed-worker-e2e.mjs` | Duplicate requests/finalization and lost-ACK replay create one completed manifest and one settlement. |
| Worker revocation and platform kill switch | `tests/m07-postgres-integration.mjs`, `tests/seller-pairing-handler.test.mjs`, `tests/m15-postgres-integration.mjs` | Owner-bound revocation and row-locked global halt passed. |
| Public seller enrollment stays closed | `tests/m16-seller-onboarding-postgres-integration.mjs` | In production, only an active verified account with a DB-admin-issued unexpired private-alpha invite can create a seller profile. Denial, expiry, revocation, concurrency, one-time consumption and HTTP replay passed. |
| Malicious skill update or unreviewed dependency cannot silently replace a published package | `tests/worker-package-store.test.mjs`, `tests/seller-publication-contract.test.mjs`, `tests/docker-worker-supervisor-local-integration.mjs` | Hash-pinned reviewed bytes and seller approval are enforced. The pinned Docker/OpenClaw review includes hostile skill and buyer-file text followed by forbidden `read`, `exec` and `browser` requests; the effective tool policy rejects them. Independent external red-team review remains open. |
| External security review / explicit private-beta risk acceptance | No external attestation supplied | **OPEN**. Public seller onboarding must remain gated. |

The live personal-state discovery attribution test remains open: a concurrent
`codex` process held and updated the personal OpenClaw `codex-home` SQLite WAL
during the read-only scan. The test failed rather than treating that change as
proof of non-mutation; a quiesced run is required.

The security release gate is intentionally failing until its complete
required evidence exists. The table records technical component evidence, not
a claim that every malicious prompt or external review has already passed.
The attack-by-attack local evidence and its limits are itemized in
`docs/evidence/m16-attack-matrix.md`.
