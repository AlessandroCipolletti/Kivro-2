# M16 original 22 open-implementation ID review — 2026-10-07

This reviews the 22 M16-mapped `OPEN_IMPLEMENTATION` rows at the start of this
continuation against their original Master Spec sections. A passing component
is not a section-level acceptance claim. The current status in
`spec/COVERAGE.md` is authoritative; this document gives the closing action
for each row. Requirements whose source is an entire section must satisfy the
whole section, not one sentence.

| ID | Original source and current finding | Current closure/action |
| --- | --- | --- |
| `WRK-0052` | §34 testing strategy. `m16-attack-matrix.md` now enumerates every local attack, including actual OpenClaw attempts to `read`, `exec` and `browser` after hostile buyer/skill text; paid runaway requests, cgroups, network, private data and output are bounded. | **DEFERRED_VERIFICATION** for independent Docker/runtime escape and public-beta red-team review; record findings and remediation retests. |
| `PRD-0048` | **C — cross-phase roadmap gate.** Local implementation and E2E cover phases 0–6. Phase 7 needs real seller/buyer measurements; Phase 8 needs independent review and separately OPEN M25 signed-update work. | **DEFERRED_VERIFICATION.** Close with quiesced personal OpenClaw attribution, Stripe staging, private-alpha cohort metrics, M25 signed-update proof and independent hardening review. This classification does not claim Phase 8 is implemented. |
| `PRD-0049` | §41 API sketch, including seller Worker revoke. | **VERIFIED** by owner-scoped revocation HTTP handler, seller/buyer endpoints and `tests/seller-pairing-handler.test.mjs` plus existing API suites. |
| `SEC-0038` | §44 experiments A–G. B–G have actual Docker, broker, cost and installed outbound paid evidence. Experiment A's personal-state attribution is blocked by an active Codex WAL writer during the read-only scan. | **DEFERRED_VERIFICATION** for a quiesced personal OpenClaw run and complete A–G record. |
| `PRD-0051` | **C — whole-product acceptance.** Local development-credit E2E covers seller approval, buyer upload, Worker/Docker/OpenClaw, result and ledger. Stripe funding, supported M25 installation and personal-state attribution remain. | **DEFERRED_VERIFICATION.** Trace all 18 original conditions in one two-user staging run with actual Stripe test funding, ready Connect account, supported installation and quiesced personal OpenClaw. |
| `PRD-0052` | §45 undeclared seller resources inaccessible. | **VERIFIED** by real paid Docker host/network probe and read-only DB broker denial tests. |
| `PRD-0053` | §45 no free seller-machine Internet proxy. | **VERIFIED** by real paid Docker public/localhost/LAN/metadata denial and broker allowlist tests. |
| `IO-0035` | **C — whole-system acceptance.** The local development-credit path covers seller Web approval, buyer upload/quote, Worker/OpenClaw/private result, authenticated download, review/report and ledger. | **DEFERRED_VERIFICATION.** Execute and record all 44 §88 steps in one test-mode Stripe/Connect staging run with supported M25 installation and live discovery. |
| `IO-0036` | **C — exact trace evidence.** The existing 44-step trace identifies the unobserved external steps. | **DEFERRED_VERIFICATION.** Attach per-step result and evidence for one complete 44-step staging run; component reports cannot replace missing steps. |
| `WRK-0097` | §89 non-zero OpenClaw, sanitized failure, cleanup, released reservation, zero earning, buyer-safe error and retained audit. | **VERIFIED** by passing installed paid E2E with failed OpenClaw, clean Docker and temporary directories, safe buyer view, released credit, zero earning, retained transition; storage preparation failure also releases safely and Worker remains alive. |
| `WRK-0098` | §89 normal failures need no manual database edit. | **VERIFIED** by Worker-to-cloud failure/release/reconciliation and installed paid failure E2E. |
| `IO-0037` | §90 canonical Document Analyzer and second private database fixture. The document job passes read-only skill discovery/explicit selection, authenticated seller publication, buyer Web input upload, installed paid Docker/OpenClaw, buyer browser result and two private files; the second fixture validates its actual read-only database broker through Docker/OpenClaw with table/write denial. | **VERIFIED**. Original §90 requires reservation/settlement, which the authoritative development-credit ledger proves; it does not require a Stripe purchase. The distinct §92 final Stripe test gate remains open. See `docs/evidence/m16-canonical-fixtures.md`. |
| `TST-0006` | §91 entire public-onboarding security checklist. The local technical controls and attack list have executable evidence; personal-state attribution and external review remain. | **DEFERRED_VERIFICATION** for the quiesced personal-state experiment and independent assessment or explicit private-beta risk acceptance. |
| `TST-0007` | §91 public onboarding prohibition. | **VERIFIED**: production seller creation is invite-only with one-time DB-admin grants, expiry, revocation and audit; the public release gate still fails closed until the full security checklist closes. |
| `TST-0008` | **C — final release gate.** The fail-closed gate and real local Worker/Docker/OpenClaw, browser, storage and ledger path exist; provider test purchase and supported M25 installation have not run. | **DEFERRED_VERIFICATION.** Run a two-user Stripe test/Connect and installed-Worker staging path, attach result, asset and settlement evidence, then rerun `pnpm release:gate`. |
| `TST-0009` | §92 real paid E2E between distinct users. Distinct users and paid ledger in dev mode pass; Stripe mode has not run. | **DEFERRED_VERIFICATION** until external Stripe test credentials and a ready Connect account permit a real credit purchase, reservation and settlement in the installed E2E. |
| `TST-0010` | §92 a mocked OpenClaw response cannot satisfy MVP. The installed paid Worker actually runs pinned OpenClaw in Docker, accepts real tool calls and returns generated files; the deterministic model service does not replace OpenClaw. | **VERIFIED** for this individual anti-mock criterion by `tests/m16-installed-worker-e2e.mjs` and the passing broad matrix. Stripe/provider staging remains separately open under `TST-0008`, `TST-0011` and `TST-0012`. |
| `TST-0011` | §92 mocked Stripe flow cannot satisfy payment acceptance; the gateway and test runner exist but test credentials are absent. | **DEFERRED_VERIFICATION** until actual Stripe test PaymentIntent/reconciliation and ready Connect evidence are obtained. |
| `TST-0012` | §92 final staging uses provider test/sandbox plus local OpenClaw. The authentic browser, local OpenClaw and private result sides have run; the same harness has a fail-closed Stripe test mode, but provider payment/Connect has not run because test credentials and a ready account are absent. | **DEFERRED_VERIFICATION** for the external Stripe test purchase/Connect run; record provider IDs without secrets. |
| `IO-0038` | **C — historical process/final acceptance gate.** Dated milestone records exist, but some §93 chronological events cannot be recreated truthfully. Final staging/red-team evidence remains external. | **DEFERRED_VERIFICATION.** M17 audits the dated records and deviations; attach actual final staging, failure and red-team results. Never manufacture earlier events. |
| `IO-0039` | §93 milestone 1 skeleton/discovery before marketplace UI. | **VERIFIED** by the early skeleton commit, read-only discovery tests and versioned interface notes. |
| `TST-0013` | §94 strict TS, no unexplained `any`, validation, DB idempotency, errors/logs, suites, env/lockfile and no secrets. | **VERIFIED** by the itemized source/log review, targeted CLI/Worker tests, tracked/new secret-shape scan, `git diff --check` and all 32 steps in `docs/evidence/m16-boundaries.json`. Public security/payment release acceptance remains separately open. |

The ten VERIFIED promotions are backed by production code and executable
checks. The other 12 remain non-VERIFIED. Six original whole-section gates
are classified as cross-milestone or external verification above; separately
OPEN M25 signed-update and provider-profile work is not claimed complete.
Missing Stripe test credentials block final payment acceptance only; they do
not excuse local security, Worker, code-quality or backlog work.

## Current M16 section review

The original 22-row table records the starting `OPEN_IMPLEMENTATION` triage,
not the whole 51-ID M16 map. A later original §36 re-audit closed `JOB-0026`:
the installed paid Worker crash/lease/release/restart path, paid OpenClaw
failure, real Docker nonzero exit with sanitized stderr metadata, missing
sandbox and missing-secret gates now have executable evidence. See
`docs/evidence/m16-health-trust-review.md`. The current 51-ID M16 map is 28
`VERIFIED`, 18 `DEFERRED_VERIFICATION`, one historical `TESTED`, three
expressly post-MVP `DEFERRED` and one documented `USER_OVERRIDE`, with zero
`OPEN_IMPLEMENTATION` rows. `TST-0015` was reviewed against financial,
Worker, broker, sandbox and protocol sources in
`docs/evidence/m16-security-explicitness-review.md`. `IO-0041` is historical:
tests/status records exist, but a missing contemporaneous deviations and
security-issues checklist at an earlier milestone cannot be recreated.
The 18 deferred verification gates retain their exact original-source
closure dependencies in `docs/verification-backlog.md`.

The final fresh 51-ID pass on 2026-10-08 re-read each original requirement,
its whole Master Spec section when the ID is section coverage, its current
coverage evidence and the relevant production/test path. The final
`docs/evidence/m16-boundaries.json` matrix passed 32/32 on the current
production tree (02:25–02:36 UTC); the later `pnpm test` passed 338 with five
intentional skips, and lint, typecheck, architecture and coverage-audit checks
passed. The release gate correctly failed with 1,040 mandatory project-wide
unresolved rows. The 673-row backlog remains an explicit input to later
compliance work: 321 earlier-implementation, 313 later-milestone, 35 external
and four historical by the current dependency classifier. Some earlier rows
also name an M16 full-system test; their source behavior is not promoted merely
because the development-credit E2E exists. `IO-0041` remains the fifth
historical `TESTED` row even though the classifier gives precedence to its
M17 dependency. No M17 implementation or audit conclusion is claimed here.

This M16 map does not imply the full 1,954-row project catalog is complete.
The current project-wide audit still has 330 `OPEN_IMPLEMENTATION`, 338
`DEFERRED_VERIFICATION`, five `TESTED`, 361 `TODO` and six `IN_PROGRESS`
rows. M16 has newly promoted 48 previously deferred rows, 205 previously
open-implementation rows and one previously tested row to `VERIFIED` on
their individual evidence. Remaining earlier/later milestone gaps are left
visible for the independent M17 audit, rather than folded into M16's 18
cross-phase gates or described as external blockers.
