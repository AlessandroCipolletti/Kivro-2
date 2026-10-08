# Kivro Implementation Coverage

M16 implementation-stage closure (2026-10-08): the installed host-native Worker has passed a
development-credit paid job through the real Docker/OpenClaw runtime, private
storage and authoritative ledger, including restart, lost-ACK replay, Worker
crash with lease expiry, model failure and storage failure. Signed heartbeat
health and an active sandbox self-test now gate paid Cloud offers. Local inference discovery and health have
production paths; `AGT-0017`–`AGT-0019` have complete evidence, while
`AGT-0015`–`AGT-0016` remain open for their exact source criteria. The
seller browser approval path passes in development-credit E2E. Actual Stripe
test purchase, external security review, personal OpenClaw live non-mutation
and deployed provider conformance remain unproven. `pnpm release:gate`
correctly fails closed. Each `VERIFIED`
row below has its own implementation and executable evidence.

The current original-text pass also closed individual §8, §197, §§202–203,
§209, §211 and §231 contract/file/output gates after actual buyer/seller
browser, Core validator and Worker/Docker evidence. Entire-section or release
gates with additional unexecuted conditions retain their own open status. The
final local M16 matrix passed 32/32; the project-wide release gate remains red
with 1,040 mandatory unresolved rows. M16 completion is not full-spec
verification or public release approval.

> Living evidence matrix. Codex must update this file while
> implementing. Do not trust this file during final audit: verify every
> claim against code/tests.

## Status vocabulary

`TODO` · `IN_PROGRESS` · `OPEN_IMPLEMENTATION` · `IMPLEMENTED` · `TESTED` · `VERIFIED` ·
`DEFERRED_VERIFICATION` · `BLOCKED` · `DEFERRED` · `USER_OVERRIDE`

`OPEN_IMPLEMENTATION` records functionality owned by the current or an already
reached milestone that is still missing. `DEFERRED_VERIFICATION` is OPEN only
when the current milestone's implementation is present and full acceptance
depends on a named later-owned component or cross-system test. Each such ID has
a dependency and exact closing evidence in `docs/verification-backlog.md`.
Revisit it as soon as the dependent milestone introduces the missing component.
`VERIFIED` means
the requirement's full required evidence exists; `TESTED` is retained
for existing rows but must not be used as a substitute for full
verification.

`DEFERRED` is valid only when the Master Spec explicitly places the
feature post-MVP or the user explicitly approves the deferral.
`USER_OVERRIDE` records a direct user instruction that supersedes one exact
specification criterion. It is never treated as a verified original criterion;
the conflicting instruction and decision must be documented explicitly.

  --------------------------------------------------------------------------------
  Requirement   Priority   Source   Status   Implementation   Test       Notes
                                             evidence         evidence   
  ------------- ---------- -------- -------- ---------------- ---------- ---------
  `PRD-0001`    P1         §1       `TODO`   ---              ---        ---

  `PRD-0002`    P2         §1       `TODO`   ---              ---        ---

  `PRD-0003`    P2         §1       `TODO`   ---              ---        ---

  `PRD-0004`    P2         §1       `TODO`   ---              ---        ---

  `PRD-0005`    P2         §1       `TODO`   ---              ---        ---

  `PRD-0006`    P2         §1       `TODO`   ---              ---        ---

  `PRD-0007`    P2         §1       `TODO`   ---              ---        ---

  `WRK-0001`    P1         §2       `TODO`   ---              ---        ---

  `WRK-0002`    P1         §2       `TODO`   ---              ---        ---

  `WRK-0003`    P1         §2       `TODO`   ---              ---        ---

  `WRK-0004`    P1         §2       `TODO`   ---              ---        ---

  `WRK-0005`    P1         §2       `TODO`   ---              ---        ---

  `WRK-0006`    P1         §2       `TODO`   ---              ---        ---

  `WRK-0007`    P1         §2       `TODO`   ---              ---        ---

  `WRK-0008`    P1         §2       `TODO`   ---              ---        ---

  `WRK-0009`    P1         §2       `TODO`   ---              ---        ---

  `PRD-0008`    P1         §3       `TODO`   ---              ---        ---

  `PRD-0009`    P2         §3       `TODO`   ---              ---        ---

  `PRD-0010`    P2         §3       `DEFERRED_VERIFICATION`   packages/openclaw-adapter/src/read-only-discovery.ts,apps/worker/src/cli.ts tests/openclaw-discovery.test.mjs,tests/worker-cli.test.mjs,tools/test-openclaw-readonly-live.mjs Read-only implementation and controlled fixture pass. Live personal-state attribution requires a quiesced OpenClaw installation or independent filesystem write trace; active Codex WAL writes prevent causal proof. backlog:PRD-0010

  `PRD-0011`    P2         §3       `TODO`   ---              ---        ---

  `PRD-0012`    P2         §3       `TODO`   ---              ---        ---

  `PRD-0013`    P1         §4       `OPEN_IMPLEMENTATION`   packages/contracts/src/account.ts,packages/domain/src/account.ts tests/account.test.mjs baseline only;  backlog:PRD-0013 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `PRD-0014`    P2         §4       `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0014

  `PRD-0015`    P2         §4       `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0015 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `PRD-0016`    P1         §5       `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0016

  `PRD-0017`    P2         §5       `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0017

  `PRD-0018`    P2         §5       `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0018

  `PRD-0019`    P2         §5       `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0019

  `PRD-0020`    P2         §5       `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0020

  `PRD-0021`    P2         §5       `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0021

  `WRK-0010`    P1         §6       `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0010

  `WRK-0011`    P1         §7       `OPEN_IMPLEMENTATION`   ---              ---        --- backlog:WRK-0011

  `WRK-0012`    P1         §7       `VERIFIED`   tools/architecture.mjs,packages/openclaw-adapter/   tests/architecture.test.mjs   No vendored OpenClaw fork or OpenClaw package dependency; installed runtime remains external

  `WRK-0013`    P1         §7       `VERIFIED`   tools/architecture.mjs,packages/openclaw-adapter/   tests/architecture.test.mjs   Direct OpenClaw API/process access outside the adapter is rejected by the import/boundary gate

  `WRK-0014`    P1         §7       `DEFERRED_VERIFICATION`   packages/openclaw-adapter/src/discovery.ts   tests/openclaw-discovery.test.mjs   Version detected; compatibility unverified backlog:WRK-0014

  `WRK-0015`    P1         §7       `DEFERRED_VERIFICATION`   packages/openclaw-adapter/src/read-only-discovery.ts,packages/openclaw-adapter/src/command-runner.ts,apps/worker/src/cli.ts   tests/openclaw-discovery.test.mjs,tests/worker-cli.test.mjs,tools/test-openclaw-readonly-live.mjs   Discovery performs read-only inspection and fixture/CLI integrity checks pass; independent live non-mutation attribution needs a quiesced installation or filesystem write trace. backlog:WRK-0015

  `WRK-0016`    P1         §7       `DEFERRED_VERIFICATION`   packages/openclaw-adapter/src/read-only-discovery.ts,packages/openclaw-adapter/src/command-runner.ts,apps/worker/src/cli.ts   tests/openclaw-discovery.test.mjs,tests/worker-cli.test.mjs,tools/test-openclaw-readonly-live.mjs   No personal configuration write path exists in the adapter and controlled tests pass; an active personal installation changes WAL metadata independently during scans, so final attribution remains external. backlog:WRK-0016

  `WRK-0017`    P1         §7       `OPEN_IMPLEMENTATION`   packages/openclaw-adapter/src/read-only-discovery.ts   tests/openclaw-discovery.test.mjs   Local normalized file-backed candidates and configured references; authoritative inventory incomplete backlog:WRK-0017

  `WRK-0018`    P1         §7       `OPEN_IMPLEMENTATION`   packages/openclaw-adapter/src/read-only-discovery.ts,tools/inspect-openclaw.mjs   tests/openclaw-discovery.test.mjs   Local result redacts paths/values; cloud metadata boundary not built backlog:WRK-0018

  `WRK-0019`    P1         §7       `OPEN_IMPLEMENTATION`   ---              ---        --- backlog:WRK-0019

  `WRK-0020`    P1         §7       `OPEN_IMPLEMENTATION`   ---              ---        --- backlog:WRK-0020

  `WRK-0021`    P1         §7       `OPEN_IMPLEMENTATION`   packages/application/src/local-resource-broker.ts,packages/persistence/src/postgres-readonly-resource.ts   tests/m06-postgres-integration.mjs   M06 component evidence; backlog:WRK-0021

  `WRK-0022`    P1         §7       `OPEN_IMPLEMENTATION`   ---              ---        --- backlog:WRK-0022

  `WRK-0023`    P1         §7       `OPEN_IMPLEMENTATION`   ---              ---        --- backlog:WRK-0023

  `WRK-0024`    P1         §7       `VERIFIED`   packages/openclaw-adapter/src/job-config.ts,runtime/openclaw/runner.mjs,packages/sandbox-adapter/src/docker.ts   tests/openclaw-job-config.test.mjs,tests/docker-openclaw-exec-local-integration.mjs   Per-job HOME/state and read-only input mount exclude seller personal OpenClaw directory; real image host sentinel denial passes

  `WRK-0025`    P1         §7       `VERIFIED`   packages/openclaw-adapter/src/worker-environment.ts,apps/worker/src/execution-runtime.ts,packages/sandbox-adapter/src/docker.ts   tests/worker-environment.test.mjs,tests/m16-installed-worker-e2e.mjs   The installed seller Worker runs a paid Docker/OpenClaw job with a seeded personal OpenClaw session under its host HOME. The sandbox, model request, buyer capability page and private result omit the session sentinel; only isolated job state is mounted.

  `WRK-0026`    P1         §7       `OPEN_IMPLEMENTATION`   packages/openclaw-adapter/src/worker-environment.ts   tests/worker-environment.test.mjs   No personal files imported by builder backlog:WRK-0026

  `WRK-0027`    P1         §7       `OPEN_IMPLEMENTATION`   ---              ---        --- backlog:WRK-0027

  `WRK-0028`    P1         §7       `OPEN_IMPLEMENTATION`   packages/openclaw-adapter/src/worker-environment.ts   tests/worker-environment.test.mjs   Config baseline only; effective sandbox M04 backlog:WRK-0028

  `WRK-0029`    P1         §7       `OPEN_IMPLEMENTATION`   apps/worker/src/cli.ts   tests/worker-cli.test.mjs   Doctor health remains NOT_READY backlog:WRK-0029

  `WRK-0030`    P1         §7       `OPEN_IMPLEMENTATION`   apps/worker/src/cli.ts   tests/worker-cli.test.mjs   All execution readiness checks still pending backlog:WRK-0030

  `PRD-0022`    P1         §8      `VERIFIED`   packages/contracts/src/capability-io.ts,packages/application/src/job-instructions.ts,apps/worker/src/execution-supervisor.ts   tests/capability-io.test.mjs,tests/job-instructions.test.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-capability-contract-boundary.md   Published typed contract, seller instructions, buyer input allowlist and hard runtime permissions are composed in a real paid Worker/Docker/OpenClaw run.

  `PRD-0023`    P2         §8      `VERIFIED`   packages/contracts/src/capability-io.ts,packages/contracts/src/contract-values.ts   tests/capability-io.test.mjs,tests/m16-input-contract-postgres-integration.mjs   Optional required:false fields remain optional in the published input schema and validated purchase path.

  `PRD-0024`    P2         §8      `VERIFIED`   packages/contracts/src/contract-values.ts,apps/web/src/buyer-api/handler.ts,apps/web/src/worker/control-handler.ts   tests/m13-postgres-integration.mjs   Undeclared buyer input is rejected before booking; signed accepted Worker input contains only declared fields.

  `PRD-0025`    P2         §8      `VERIFIED`   packages/application/src/job-instructions.ts,packages/openclaw-adapter/src/job-config.ts,apps/worker/src/execution-supervisor.ts   tests/job-instructions.test.mjs,tests/m16-installed-worker-e2e.mjs   Hostile text remains buyer task data and cannot expand the versioned tool, resource or execution policy.

  `PRD-0026`    P2         §8      `VERIFIED`   packages/application/src/job-instructions.ts,packages/openclaw-adapter/src/job-config.ts,apps/worker/src/execution-supervisor.ts   tests/job-instructions.test.mjs,tests/m16-installed-worker-e2e.mjs   Buyer-controlled text is labeled untrusted, separately serialized and constrained by hard Worker/sandbox policy in the installed paid run.

  `PRD-0027`    P2         §8      `VERIFIED`   packages/application/src/job-instructions.ts,packages/openclaw-adapter/src/job-config.ts   tests/job-instructions.test.mjs,tests/m16-installed-worker-e2e.mjs   Buyer text is serialized in a separate untrusted section, never concatenated into fixed platform instructions; installed execution enforces hard policy.

  `PRD-0028`    P2         §8      `VERIFIED`   packages/application/src/job-instructions.ts,apps/worker/src/execution-supervisor.ts,packages/policy-engine/src   tests/m16-installed-worker-e2e.mjs,tests/docker-openclaw-selected-file-local-integration.mjs   Installed capability follows immutable declared contract and denied undeclared host, tool and network actions under hostile input.

  `PRD-0029`    P2         §8      `VERIFIED`   packages/application/src/job-instructions.ts,packages/openclaw-adapter/src/job-config.ts,apps/worker/src/execution-supervisor.ts   tests/m16-installed-worker-e2e.mjs,tests/docker-openclaw-selected-file-local-integration.mjs   Hostile buyer and research text cannot change the allowed tools, permissions, policy, destinations or secrets in real Docker/OpenClaw execution.

  `PRD-0030`    P2         §8      `VERIFIED`   packages/policy-engine/src,apps/worker/src/execution-supervisor.ts,packages/sandbox-adapter/src/docker.ts   tests/m16-installed-worker-e2e.mjs,tests/docker-openclaw-selected-file-local-integration.mjs   Hard tool/resource/network/host boundaries, rather than prompt wording, deny unauthorized actions in installed paid and focused Docker/OpenClaw runs.

  `JOB-0001`    P1         §9       `DEFERRED_VERIFICATION`   packages/domain/src/job-lifecycle.ts,packages/persistence/src/job-execution.ts,packages/persistence/migrations/0014_job_execution.sql   tests/job-lifecycle.test.mjs,tests/m07-postgres-integration.mjs   M07 implementation evidence; cross-milestone gate backlog:JOB-0001 M08 component evidence: packages/persistence/src/finance.ts,tests/m08-finance-postgres-integration.mjs; backlog:JOB-0001

  `JOB-0002`    P1         §9       `DEFERRED_VERIFICATION`   packages/domain/src/job-lifecycle.ts,packages/persistence/src/job-execution.ts,packages/persistence/migrations/0014_job_execution.sql   tests/job-lifecycle.test.mjs,tests/m07-postgres-integration.mjs   M07 implementation evidence; cross-milestone gate backlog:JOB-0002 M08 component evidence: packages/persistence/src/finance.ts,tests/m08-finance-postgres-integration.mjs; backlog:JOB-0002

  `JOB-0003`    P1         §9       `DEFERRED_VERIFICATION`   packages/domain/src/job-lifecycle.ts,packages/persistence/src/job-execution.ts,packages/persistence/migrations/0014_job_execution.sql   tests/job-lifecycle.test.mjs,tests/m07-postgres-integration.mjs   M07 implementation evidence; cross-milestone gate backlog:JOB-0003 M08 component evidence: packages/persistence/src/finance.ts,tests/m08-finance-postgres-integration.mjs; backlog:JOB-0003

  `JOB-0004`    P1         §9       `DEFERRED_VERIFICATION`   packages/domain/src/job-lifecycle.ts,packages/persistence/src/job-execution.ts,packages/persistence/migrations/0014_job_execution.sql   tests/job-lifecycle.test.mjs,tests/m07-postgres-integration.mjs   M07 implementation evidence; cross-milestone gate backlog:JOB-0004 M08 component evidence: packages/persistence/src/finance.ts,tests/m08-finance-postgres-integration.mjs; backlog:JOB-0004

  `WRK-0031`    P1         §10      `VERIFIED`   apps/worker/src/device-identity.ts,apps/worker/src/dispatch-loop.ts,packages/worker-protocol/src/messages.ts,packages/infrastructure/netsons/src/https-polling.ts,packages/infrastructure/adapters/src/websocket-worker.ts,packages/persistence/src/worker-pairing.ts   tests/m07-postgres-integration.mjs,tests/worker-mixed-transport.test.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-worker-connectivity-review.md   Full §10 outbound signed Worker pairing/polling/WSS and safe heartbeat boundary passes local live transport and paid job tests; deployment-profile conformance is separately open.

  `WRK-0032`    P1         §10      `VERIFIED`   packages/worker-protocol/src/transport.ts,packages/infrastructure/netsons/src/https-polling.ts,packages/infrastructure/adapters/src/websocket-worker.ts   tests/worker-mixed-transport.test.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-worker-connectivity-review.md   The seller Worker initiates authenticated outbound HTTPS polling or WebSocket connections; the paid local job needs no inbound seller port, public IP, database or firewall change.

  `WRK-0033`    P1         §10      `VERIFIED`   apps/worker/src/device-identity.ts,packages/persistence/src/worker-pairing.ts   tests/seller-pairing-handler.test.mjs,tests/m07-postgres-integration.mjs,docs/evidence/m16-worker-connectivity-review.md   One-time expiring pairing code binds an encrypted/keychain-backed device key to a seller; the daemon stores no reusable seller password.

  `WRK-0034`    P1         §10      `VERIFIED`   packages/worker-protocol/src/messages.ts,apps/worker/src/dispatch-loop.ts,packages/persistence/src/worker-heartbeat.ts   tests/m07-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-worker-connectivity-review.md   Strict versioned heartbeat carries only bounded operational/readiness metadata and is accepted by cloud before paid dispatch.

  `WRK-0035`    P1         §10      `VERIFIED`   packages/worker-protocol/src/messages.ts,apps/worker/src/dispatch-loop.ts,apps/worker/src/runtime-readiness.ts   tests/worker-transport.test.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-worker-connectivity-review.md   The strict heartbeat/hello payload excludes local paths, environment values and credentials; seller identity is a scoped device signature rather than a password.

  `JOB-0005`    P1         §11      `DEFERRED_VERIFICATION`   packages/persistence/src/job-execution.ts,apps/worker/src/job-admission.ts,apps/worker/src/execution-supervisor.ts,apps/worker/src/dispatch-loop.ts,packages/worker-protocol/src/messages.ts   tests/worker-admission.test.mjs,tests/m07-postgres-integration.mjs,tests/m07-result-postgres-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs   M07 implementation evidence; cross-milestone gate backlog:JOB-0005 M08 component evidence: packages/persistence/src/finance.ts,tests/m08-finance-postgres-integration.mjs; backlog:JOB-0005

  `JOB-0006`    P1         §11      `DEFERRED_VERIFICATION`   packages/persistence/src/job-execution.ts,apps/worker/src/job-admission.ts,apps/worker/src/execution-supervisor.ts,apps/worker/src/dispatch-loop.ts,packages/worker-protocol/src/messages.ts   tests/worker-admission.test.mjs,tests/m07-postgres-integration.mjs,tests/m07-result-postgres-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs   M07 implementation evidence; cross-milestone gate backlog:JOB-0006 M08 component evidence: packages/persistence/src/finance.ts,tests/m08-finance-postgres-integration.mjs; backlog:JOB-0006

  `JOB-0007`    P1         §11      `DEFERRED_VERIFICATION`   packages/persistence/src/job-execution.ts,apps/worker/src/job-admission.ts,apps/worker/src/execution-supervisor.ts,apps/worker/src/dispatch-loop.ts,packages/worker-protocol/src/messages.ts   tests/worker-admission.test.mjs,tests/m07-postgres-integration.mjs,tests/m07-result-postgres-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs   M07 implementation evidence; cross-milestone gate backlog:JOB-0007 M08 component evidence: packages/persistence/src/finance.ts,tests/m08-finance-postgres-integration.mjs; backlog:JOB-0007

  `IO-0001` P1 §12 `VERIFIED` packages/persistence/src/marketplace-assets.ts,packages/application/src/input-object-validation.ts,apps/worker/src/input-staging.ts,packages/sandbox-adapter/src/docker.ts tests/m10-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,tests/docker-sandbox-local-integration.mjs,docs/evidence/m16-buyer-file-input-review.md Original §12 reviewed: bounded allowlisted MIME/extension, final-object ClamAV scan before READY, UUID names, read-only input, isolated output, seller Documents/Downloads/Desktop denied and terminal attempt cleanup. Real paid development-credit browser/Worker/Docker path passes; Stripe staging is a separate release gate.

  `IO-0002` P1 §12 `VERIFIED` packages/persistence/src/marketplace-assets.ts,packages/application/src/input-object-validation.ts,apps/worker/src/input-staging.ts,packages/sandbox-adapter/src/docker.ts tests/m10-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,tests/docker-sandbox-local-integration.mjs,docs/evidence/m16-buyer-file-input-review.md Original §12 reviewed: bounded allowlisted MIME/extension, final-object ClamAV scan before READY, UUID names, read-only input, isolated output, seller Documents/Downloads/Desktop denied and terminal attempt cleanup. Real paid development-credit browser/Worker/Docker path passes; Stripe staging is a separate release gate.

  `IO-0003` P1 §12 `VERIFIED` packages/persistence/src/marketplace-assets.ts,packages/application/src/input-object-validation.ts,apps/worker/src/input-staging.ts,packages/sandbox-adapter/src/docker.ts tests/m10-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,tests/docker-sandbox-local-integration.mjs,docs/evidence/m16-buyer-file-input-review.md Original §12 reviewed: bounded allowlisted MIME/extension, final-object ClamAV scan before READY, UUID names, read-only input, isolated output, seller Documents/Downloads/Desktop denied and terminal attempt cleanup. Real paid development-credit browser/Worker/Docker path passes; Stripe staging is a separate release gate.

  `IO-0004` P1 §12 `VERIFIED` packages/persistence/src/marketplace-assets.ts,packages/application/src/input-object-validation.ts,apps/worker/src/input-staging.ts,packages/sandbox-adapter/src/docker.ts tests/m10-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,tests/docker-sandbox-local-integration.mjs,docs/evidence/m16-buyer-file-input-review.md Original §12 reviewed: bounded allowlisted MIME/extension, final-object ClamAV scan before READY, UUID names, read-only input, isolated output, seller Documents/Downloads/Desktop denied and terminal attempt cleanup. Real paid development-credit browser/Worker/Docker path passes; Stripe staging is a separate release gate.

  `IO-0005` P1 §12 `VERIFIED` packages/persistence/src/marketplace-assets.ts,packages/application/src/input-object-validation.ts,apps/worker/src/input-staging.ts,packages/sandbox-adapter/src/docker.ts tests/m10-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,tests/docker-sandbox-local-integration.mjs,docs/evidence/m16-buyer-file-input-review.md Original §12 reviewed: bounded allowlisted MIME/extension, final-object ClamAV scan before READY, UUID names, read-only input, isolated output, seller Documents/Downloads/Desktop denied and terminal attempt cleanup. Real paid development-credit browser/Worker/Docker path passes; Stripe staging is a separate release gate.

  `IO-0006` P1 §12 `VERIFIED` packages/persistence/src/marketplace-assets.ts,packages/application/src/input-object-validation.ts,apps/worker/src/input-staging.ts,packages/sandbox-adapter/src/docker.ts tests/m10-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,tests/docker-sandbox-local-integration.mjs,docs/evidence/m16-buyer-file-input-review.md Original §12 reviewed: bounded allowlisted MIME/extension, final-object ClamAV scan before READY, UUID names, read-only input, isolated output, seller Documents/Downloads/Desktop denied and terminal attempt cleanup. Real paid development-credit browser/Worker/Docker path passes; Stripe staging is a separate release gate.

  `SEC-0001`    P1         §13      `DEFERRED_VERIFICATION`   packages/openclaw-adapter/src/job-config.ts,apps/worker/src/broker-sidecar.ts,packages/application/src/completion-broker.ts   tests/openclaw-job-config.test.mjs,tests/openclaw-completion-broker.test.mjs,tests/docker-worker-supervisor-local-integration.mjs   M07 implementation evidence; cross-milestone gate backlog:SEC-0001

  `SEC-0002`    P0         §13      `DEFERRED_VERIFICATION`   packages/openclaw-adapter/src/job-config.ts,apps/worker/src/broker-sidecar.ts,packages/application/src/completion-broker.ts   tests/openclaw-job-config.test.mjs,tests/openclaw-completion-broker.test.mjs,tests/docker-worker-supervisor-local-integration.mjs   M07 implementation evidence; cross-milestone gate backlog:SEC-0002

  `SEC-0003`    P0         §13      `DEFERRED_VERIFICATION`   packages/openclaw-adapter/src/job-config.ts,apps/worker/src/broker-sidecar.ts,packages/application/src/completion-broker.ts   tests/openclaw-job-config.test.mjs,tests/openclaw-completion-broker.test.mjs,tests/docker-worker-supervisor-local-integration.mjs   M07 implementation evidence; cross-milestone gate backlog:SEC-0003

  `SEC-0004`    P0         §13      `DEFERRED_VERIFICATION`   packages/openclaw-adapter/src/job-config.ts,apps/worker/src/broker-sidecar.ts,packages/application/src/completion-broker.ts   tests/openclaw-job-config.test.mjs,tests/openclaw-completion-broker.test.mjs,tests/docker-worker-supervisor-local-integration.mjs   M07 implementation evidence; cross-milestone gate backlog:SEC-0004

  `SEC-0005`    P0         §13      `DEFERRED_VERIFICATION`   packages/openclaw-adapter/src/job-config.ts,apps/worker/src/broker-sidecar.ts,packages/application/src/completion-broker.ts   tests/openclaw-job-config.test.mjs,tests/openclaw-completion-broker.test.mjs,tests/docker-worker-supervisor-local-integration.mjs   M07 implementation evidence; cross-milestone gate backlog:SEC-0005

  `SEC-0006`    P0         §13      `DEFERRED_VERIFICATION`   apps/worker/src/seller-credential-vault.ts,apps/worker/src/cli.ts   tests/m12-seller-vault.test.mjs,tests/worker-cli.test.mjs   M12 component evidence; full gate remains OPEN; backlog:SEC-0006

  `SEC-0007`    P0         §13      `DEFERRED_VERIFICATION`   packages/openclaw-adapter/src/job-config.ts,apps/worker/src/broker-sidecar.ts,packages/application/src/completion-broker.ts   tests/openclaw-job-config.test.mjs,tests/openclaw-completion-broker.test.mjs,tests/docker-worker-supervisor-local-integration.mjs   M07 implementation evidence; cross-milestone gate backlog:SEC-0007

  `SEC-0008`    P0         §13      `DEFERRED_VERIFICATION`   packages/openclaw-adapter/src/job-config.ts,apps/worker/src/broker-sidecar.ts,packages/application/src/completion-broker.ts   tests/openclaw-job-config.test.mjs,tests/openclaw-completion-broker.test.mjs,tests/docker-worker-supervisor-local-integration.mjs   M07 implementation evidence; cross-milestone gate backlog:SEC-0008

  `SEC-0009`    P1         §14      `VERIFIED`   packages/application/src/local-resource-broker.ts,packages/persistence/src/postgres-readonly-resource.ts,apps/worker/src/resource-ports.ts,apps/worker/src/broker-router.ts   tests/m06-postgres-integration.mjs,tests/docker-sandbox-resources-local-integration.mjs,docs/evidence/m16-database-boundary.md   Whole §14 broker boundary: dedicated SELECT-only role, named scoped operation, real Docker/OpenClaw invocation, private-table/write/injection denial, no credential/model/public leak.

  `SEC-0010`    P0         §14      `VERIFIED`   packages/application/src/local-resource-broker.ts,packages/persistence/src/postgres-readonly-resource.ts,apps/worker/src/resource-ports.ts,apps/worker/src/broker-router.ts   tests/m06-postgres-integration.mjs,tests/docker-sandbox-resources-local-integration.mjs,docs/evidence/m16-database-boundary.md   Private database risk is contained by the explicit per-version Local Resource Broker and verified by real Docker/OpenClaw execution and denial probes.

  `SEC-0011`    P0         §14      `VERIFIED`   packages/application/src/local-resource-broker.ts,packages/persistence/src/postgres-readonly-resource.ts,apps/worker/src/resource-ports.ts,apps/worker/src/broker-router.ts   tests/m06-postgres-integration.mjs,tests/docker-sandbox-resources-local-integration.mjs,docs/evidence/m16-database-boundary.md   Dedicated NOSUPERUSER/NOCREATEDB/NOCREATEROLE role has SELECT on one allowed table; privileged credential blocks Worker readiness.

  `SEC-0012`    P0         §14      `VERIFIED`   packages/application/src/local-resource-broker.ts,packages/persistence/src/postgres-readonly-resource.ts,apps/worker/src/resource-ports.ts,apps/worker/src/broker-router.ts   tests/m06-postgres-integration.mjs,tests/docker-sandbox-resources-local-integration.mjs,docs/evidence/m16-database-boundary.md   Broker restricts table, columns, tenant and row count; private-schema reads and writes fail under the dedicated role.

  `SEC-0013`    P0         §14      `VERIFIED`   packages/application/src/local-resource-broker.ts,packages/persistence/src/postgres-readonly-resource.ts,apps/worker/src/resource-ports.ts,apps/worker/src/broker-router.ts   tests/m06-postgres-integration.mjs,tests/docker-sandbox-resources-local-integration.mjs,docs/evidence/m16-database-boundary.md   Worker resolves the DB credential outside Docker; OpenClaw receives only a named broker tool and bounded row, not connection credentials.

  `SEC-0014`    P0         §14      `VERIFIED`   packages/application/src/local-resource-broker.ts,packages/persistence/src/postgres-readonly-resource.ts,apps/worker/src/resource-ports.ts,apps/worker/src/broker-router.ts   tests/m06-postgres-integration.mjs,tests/docker-sandbox-resources-local-integration.mjs,docs/evidence/m16-database-boundary.md   Kivro uses the stronger broker route rather than the conditional private-beta direct-DB exception.

  `SEC-0015`    P0         §14      `VERIFIED`   packages/application/src/local-resource-broker.ts,packages/persistence/src/postgres-readonly-resource.ts,apps/worker/src/resource-ports.ts,apps/worker/src/broker-router.ts   tests/m06-postgres-integration.mjs,tests/docker-sandbox-resources-local-integration.mjs,docs/evidence/m16-database-boundary.md   The specified Local Resource Broker target is implemented and executed by pinned isolated OpenClaw.

  `WRK-0036`    P1         §15      `VERIFIED`   packages/contracts/src/worker-manifest.ts,packages/policy-engine/src/sandbox.ts,packages/openclaw-adapter/src/job-config.ts,runtime/openclaw/Dockerfile   tests/sandbox-policy.test.mjs,tests/openclaw-job-config.test.mjs,tests/docker-openclaw-exec-local-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-tool-policy-review.md   Real pinned Docker/OpenClaw hostile-skill and buyer-input tools are denied by the effective allowlist; seller review rejects browser/shell policy, and only explicit narrow broker tools execute. See docs/evidence/m16-tool-policy-review.md.

  `WRK-0037`    P1         §15      `VERIFIED`   packages/contracts/src/worker-manifest.ts,packages/policy-engine/src/sandbox.ts,packages/openclaw-adapter/src/job-config.ts,runtime/openclaw/Dockerfile   tests/sandbox-policy.test.mjs,tests/openclaw-job-config.test.mjs,tests/docker-openclaw-exec-local-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-tool-policy-review.md   Real pinned Docker/OpenClaw hostile-skill and buyer-input tools are denied by the effective allowlist; seller review rejects browser/shell policy, and only explicit narrow broker tools execute. See docs/evidence/m16-tool-policy-review.md.

  `WRK-0038`    P1         §15      `VERIFIED`   packages/contracts/src/worker-manifest.ts,packages/policy-engine/src/sandbox.ts,packages/openclaw-adapter/src/job-config.ts,runtime/openclaw/Dockerfile   tests/sandbox-policy.test.mjs,tests/openclaw-job-config.test.mjs,tests/docker-openclaw-exec-local-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-tool-policy-review.md   Real pinned Docker/OpenClaw hostile-skill and buyer-input tools are denied by the effective allowlist; seller review rejects browser/shell policy, and only explicit narrow broker tools execute. See docs/evidence/m16-tool-policy-review.md.

  `WRK-0039`    P1         §15      `VERIFIED`   packages/contracts/src/worker-manifest.ts,packages/policy-engine/src/sandbox.ts,packages/openclaw-adapter/src/job-config.ts,runtime/openclaw/Dockerfile   tests/sandbox-policy.test.mjs,tests/openclaw-job-config.test.mjs,tests/docker-openclaw-exec-local-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-tool-policy-review.md   Real pinned Docker/OpenClaw hostile-skill and buyer-input tools are denied by the effective allowlist; seller review rejects browser/shell policy, and only explicit narrow broker tools execute. See docs/evidence/m16-tool-policy-review.md.

  `WRK-0040`    P1         §15      `VERIFIED`   packages/contracts/src/worker-manifest.ts,packages/policy-engine/src/sandbox.ts,packages/openclaw-adapter/src/job-config.ts,runtime/openclaw/Dockerfile   tests/sandbox-policy.test.mjs,tests/openclaw-job-config.test.mjs,tests/docker-openclaw-exec-local-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-tool-policy-review.md   Real pinned Docker/OpenClaw hostile-skill and buyer-input tools are denied by the effective allowlist; seller review rejects browser/shell policy, and only explicit narrow broker tools execute. See docs/evidence/m16-tool-policy-review.md.

  `WRK-0041`    P1         §15      `VERIFIED`   packages/contracts/src/worker-manifest.ts,packages/policy-engine/src/sandbox.ts,packages/openclaw-adapter/src/job-config.ts,runtime/openclaw/Dockerfile   tests/sandbox-policy.test.mjs,tests/openclaw-job-config.test.mjs,tests/docker-openclaw-exec-local-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-tool-policy-review.md   Real pinned Docker/OpenClaw hostile-skill and buyer-input tools are denied by the effective allowlist; seller review rejects browser/shell policy, and only explicit narrow broker tools execute. See docs/evidence/m16-tool-policy-review.md.

  `WRK-0042`    P1         §15      `VERIFIED`   packages/contracts/src/worker-manifest.ts,packages/policy-engine/src/sandbox.ts,packages/openclaw-adapter/src/job-config.ts,runtime/openclaw/Dockerfile   tests/sandbox-policy.test.mjs,tests/openclaw-job-config.test.mjs,tests/docker-openclaw-exec-local-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-tool-policy-review.md   Real pinned Docker/OpenClaw hostile-skill and buyer-input tools are denied by the effective allowlist; seller review rejects browser/shell policy, and only explicit narrow broker tools execute. See docs/evidence/m16-tool-policy-review.md.

  `SEC-0016`    P1         §16     `DEFERRED_VERIFICATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   M06 component evidence; backlog:SEC-0016 M08 component evidence: packages/persistence/src/finance.ts,tests/m08-finance-postgres-integration.mjs; backlog:SEC-0016

  `SEC-0017`    P0         §16     `DEFERRED_VERIFICATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   M06 component evidence; backlog:SEC-0017 M08 component evidence: packages/persistence/src/finance.ts,tests/m08-finance-postgres-integration.mjs; backlog:SEC-0017

  `SEC-0018`    P0         §16     `DEFERRED_VERIFICATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   M06 component evidence; backlog:SEC-0018 M08 component evidence: packages/persistence/src/finance.ts,tests/m08-finance-postgres-integration.mjs; backlog:SEC-0018

  `SEC-0019`    P0         §16     `DEFERRED_VERIFICATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   M06 component evidence; backlog:SEC-0019 M08 component evidence: packages/persistence/src/finance.ts,tests/m08-finance-postgres-integration.mjs; backlog:SEC-0019

  `SEC-0020`    P0         §16     `DEFERRED_VERIFICATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   M06 component evidence; backlog:SEC-0020 M08 component evidence: packages/persistence/src/finance.ts,tests/m08-finance-postgres-integration.mjs; backlog:SEC-0020

  `SEC-0021`    P0         §16     `DEFERRED_VERIFICATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   M06 component evidence; backlog:SEC-0021 M08 component evidence: packages/persistence/src/finance.ts,tests/m08-finance-postgres-integration.mjs; backlog:SEC-0021

  `SEC-0022` P1 §17 `VERIFIED` apps/worker/src/broker-router.ts,packages/openclaw-adapter/src/job-config.ts,packages/sandbox-adapter/src/docker.ts tests/worker-broker-router.test.mjs,tests/docker-worker-supervisor-local-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-browser-policy-review.md Original §17 MVP prohibition: browser tools and browser policy fail seller review/job admission; real pinned Docker/OpenClaw hostile-file browser request is denied. Future cloud browser requirements remain explicitly DEFERRED under SEC-0024/SEC-0025.

  `SEC-0023` P0 §17 `VERIFIED` apps/worker/src/broker-router.ts,packages/openclaw-adapter/src/job-config.ts,packages/sandbox-adapter/src/docker.ts tests/worker-broker-router.test.mjs,tests/docker-worker-supervisor-local-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-browser-policy-review.md Original §17 MVP prohibition: browser tools and browser policy fail seller review/job admission; real pinned Docker/OpenClaw hostile-file browser request is denied. Future cloud browser requirements remain explicitly DEFERRED under SEC-0024/SEC-0025.

  `SEC-0024` P0 §17 `DEFERRED` spec/MASTER-SPEC.md §17 tests/worker-broker-router.test.mjs,tests/docker-worker-supervisor-local-integration.mjs Original §17 explicitly makes this conditional on a future browser capability. MVP exposes no cloud browser service; if added later, it must be marketplace-controlled and isolated from seller personal browser/IP.

  `SEC-0025` P0 §17 `DEFERRED` spec/MASTER-SPEC.md §17 tests/worker-broker-router.test.mjs,tests/docker-worker-supervisor-local-integration.mjs Original §17 cloud-browser safeguards apply only if the post-MVP browser service is introduced. The future service must prove isolated sessions, no seller cookies/private network, domain/action/rate policy, audit and kill switch before activation.

  `PRD-0031`    P1         §18     `OPEN_IMPLEMENTATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:PRD-0031 M06 component review:docs/milestones/M06.md M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `PRD-0032`    P2         §18     `VERIFIED`   spec/SECURITY-EVIDENCE.md,docs/evidence/m16-attack-matrix.md   docs/evidence/m16-threat-model-review.md,tests/docker-sandbox-local-integration.mjs   Security model explicitly separates malicious buyer, third party, seller, skill/plugin and compromised-cloud actors with corresponding technical boundaries and attack probes.

  `PRD-0033`    P2         §18     `VERIFIED`   packages/sandbox-adapter/src/docker.ts,apps/worker/src/job-admission.ts   tests/docker-sandbox-local-integration.mjs,tests/docker-openclaw-file-tools-local-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-threat-model-review.md   Seller cannot disable minimum sandbox/network/host isolation; real paid Docker probe denies host, LAN, metadata and Docker socket access.

  `PRD-0034`    P2         §18     `VERIFIED`   apps/web/app/privacy/page.tsx   tests/browser-m10/marketplace.spec.ts,docs/evidence/m16-threat-model-review.md   Buyer-facing privacy disclosure states seller control of the physical machine prevents a cryptographic guarantee against local observation or Worker modification.

  `PRD-0035`    P2         §18     `VERIFIED`   apps/web/app/privacy/page.tsx   tests/browser-m10/marketplace.spec.ts,docs/evidence/m16-threat-model-review.md   The seller-machine plaintext limitation is explicitly acknowledged in production buyer privacy copy and rendered browser test.

  `PRD-0036`    P2         §18     `VERIFIED`   apps/worker/src/capability-package-store.ts,apps/worker/src/runtime-readiness.ts,packages/persistence/src/seller-publication.ts   tests/worker-runtime-readiness.test.mjs,tests/seller-publication-contract.test.mjs,tests/docker-openclaw-file-tools-local-integration.mjs,docs/evidence/m16-threat-model-review.md   Reviewed skill/runtime bytes and immutable published version hashes are pinned; changed approved runtime now requires explicit seller revalidation rather than tracking latest.

  `PRD-0037`    P2         §18     `VERIFIED`   apps/worker/src/seller-credential-vault.ts,apps/worker/src/resource-ports.ts,packages/persistence/src/seller-publication.ts   tests/m06-postgres-integration.mjs,tests/worker-resource-ports.test.mjs,docs/evidence/m16-threat-model-review.md   Seller DB/API secrets stay in the local Worker vault; cloud publication stores resource references and policy metadata, not DB passwords.

  `PRD-0038`    P2         §18     `VERIFIED`   apps/worker/src/seller-credential-vault.ts,apps/worker/src/broker-router.ts,apps/worker/src/selected-local-file.ts   tests/selected-local-file.test.mjs,tests/docker-openclaw-selected-file-local-integration.mjs,tests/m06-postgres-integration.mjs,docs/evidence/m16-threat-model-review.md   Cloud lacks arbitrary seller resource access; Worker-local vault and explicit version/job broker grants prevent compromise from automatically exposing every seller resource.

  `JOB-0008`    P1         §19     `OPEN_IMPLEMENTATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:JOB-0008 M06 component review:docs/milestones/M06.md M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0009`    P1         §19     `OPEN_IMPLEMENTATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:JOB-0009 M06 component review:docs/milestones/M06.md M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0010`    P1         §19     `OPEN_IMPLEMENTATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:JOB-0010 M06 component review:docs/milestones/M06.md M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0011`    P1         §19     `OPEN_IMPLEMENTATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:JOB-0011 M06 component review:docs/milestones/M06.md M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0012`    P1         §19     `OPEN_IMPLEMENTATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:JOB-0012 M06 component review:docs/milestones/M06.md M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0013`    P1         §19     `OPEN_IMPLEMENTATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:JOB-0013 M06 component review:docs/milestones/M06.md M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0014`    P1         §19     `OPEN_IMPLEMENTATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:JOB-0014 M06 component review:docs/milestones/M06.md M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0015`    P1         §19     `OPEN_IMPLEMENTATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:JOB-0015 M06 component review:docs/milestones/M06.md M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0016`    P1         §19     `OPEN_IMPLEMENTATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:JOB-0016 M06 component review:docs/milestones/M06.md M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0017`    P1         §19     `OPEN_IMPLEMENTATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:JOB-0017 M06 component review:docs/milestones/M06.md M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0018`    P1         §19     `OPEN_IMPLEMENTATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:JOB-0018 M06 component review:docs/milestones/M06.md M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0019`    P1         §19     `OPEN_IMPLEMENTATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:JOB-0019 M06 component review:docs/milestones/M06.md M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0020`    P1         §19     `OPEN_IMPLEMENTATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:JOB-0020 M06 component review:docs/milestones/M06.md M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0021`    P1         §19     `OPEN_IMPLEMENTATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:JOB-0021 M06 component review:docs/milestones/M06.md M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0022`    P1         §19     `OPEN_IMPLEMENTATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:JOB-0022 M06 component review:docs/milestones/M06.md M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0023`    P1         §19     `OPEN_IMPLEMENTATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:JOB-0023 M06 component review:docs/milestones/M06.md M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0024`    P1         §19     `OPEN_IMPLEMENTATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:JOB-0024 M06 component review:docs/milestones/M06.md M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0025`    P1         §19     `OPEN_IMPLEMENTATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:JOB-0025 M06 component review:docs/milestones/M06.md M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `SEC-0026`    P1         §20      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0026

  `SEC-0027`    P0         §20      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0027

  `SEC-0028`    P0         §20      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0028

  `SEC-0029`    P0         §20      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0029

  `SEC-0030`    P0         §20      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0030

  `SEC-0031`    P0         §20      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0031

  `WRK-0043`    P1         §21      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0043

  `WRK-0044`    P1         §21      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0044

  `WRK-0045`    P1         §21      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0045

  `WRK-0046`    P1         §22      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0046

  `WRK-0047`    P1         §22      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0047

  `CAP-0001`    P1         §23      `OPEN_IMPLEMENTATION`   packages/persistence/migrations/0001_foundation.sql tests/sql/m01_foundation.sql baseline only;  backlog:CAP-0001 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `PAY-0001`    P1         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0001

  `PAY-0002`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0002

  `PAY-0003`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0004`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0004

  `PAY-0005`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0006`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0006

  `PAY-0007`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0008`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0008

  `PAY-0009`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0009

  `PAY-0010`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0011`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0012`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0012

  `PAY-0013`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0014`    P0         §24      `TODO`   ---   ---   OPEN later-owned implementation: M23/M28 legal, tax, accounting and release decisions; docs/milestones/M08.md

  `PAY-0015`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0015

  `PAY-0016`    P0         §24      `DEFERRED`   ---   ---   OPEN later-owned implementation: §24.25 P5 future direct-payment option after prepaid-credit MVP; docs/milestones/M08.md

  `PAY-0017`    P0         §24      `TODO`   ---   ---   OPEN later-owned implementation: M09 availability and authorization-window policy; docs/milestones/M08.md

  `PAY-0018`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0018

  `PAY-0019`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0019

  `PAY-0020`    P0         §24      `TODO`   ---   ---   OPEN later-owned implementation: M23/M28 legal, tax, accounting and release decisions; docs/milestones/M08.md

  `PAY-0021`    P0         §24      `DEFERRED`   ---   ---   OPEN later-owned implementation: §24.25 P5 future direct-payment option after prepaid-credit MVP; docs/milestones/M08.md

  `PAY-0022`    P0         §24      `TODO`   ---   ---   OPEN later-owned implementation: M10 buyer billing and price UI plus M13 authenticated API; docs/milestones/M08.md

  `PAY-0023`    P0         §24      `DEFERRED`   ---   ---   OPEN implementation for §24.5 direct per-job PaymentIntent authorization/capture flow after prepaid-credit MVP; a credit reservation does not verify this direct-payment step. docs/milestones/M08.md

  `PAY-0024`    P0         §24      `TODO`   ---   ---   OPEN later-owned implementation: M10 buyer billing and price UI plus M13 authenticated API; docs/milestones/M08.md

  `PAY-0025`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0026`    P0         §24      `TODO`   ---   ---   OPEN later-owned implementation: M10 buyer billing and price UI plus M13 authenticated API; docs/milestones/M08.md

  `PAY-0027`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0027

  `PAY-0028`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0028

  `PAY-0029`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0030`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0031`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0032`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0032

  `PAY-0033`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0033

  `PAY-0034`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0034

  `PAY-0035`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0035

  `PAY-0036`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0036

  `PAY-0037`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0037

  `PAY-0038`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0039`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0040`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0041`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0042`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0042

  `PAY-0043`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0044`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0045`    P0         §24      `TODO`   apps/web/app/seller/operations-dashboard.tsx   tests/browser-m12/seller-operations.spec.ts   M12 dashboard economics component exists; M14 prepublication economics UI remains OPEN.

  `PAY-0046`    P0         §24      `VERIFIED`   apps/web/app/seller/operations-dashboard.tsx   tests/browser-m12/seller-operations.spec.ts   M12 seller dashboard explicitly states earnings can change after refund or payment dispute and does not promise immediate irreversibility.

  `PAY-0047`    P0         §24      `TODO`   ---   ---   OPEN later-owned implementation: M23/M28 legal, tax, accounting and release decisions; docs/milestones/M08.md

  `PAY-0048`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0049`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0050`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0051`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0052`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0053`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0054`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0055`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0056`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0057`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0058`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0059`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0060`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0060

  `PAY-0061`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0061

  `PAY-0062`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0062

  `PAY-0063`    P0         §24      `DEFERRED`   ---   ---   OPEN later-owned implementation: §24.25 P5 future direct-payment option after prepaid-credit MVP; docs/milestones/M08.md

  `PAY-0064`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0065`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0066`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0066

  `PAY-0067`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0068`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0069`    P0         §24      `DEFERRED_VERIFICATION`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 component evidence only; backlog:PAY-0069

  `PAY-0070`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0071`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0072`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0073`    P0         §24      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs,tests/stripe-gateway.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PRD-0039`    P1         §25      `DEFERRED_VERIFICATION`   packages/persistence/src/provider-usage.ts,packages/application/src/seller-economics.ts,runtime/openclaw/plugin/tool-budget.mjs   tests/m06-postgres-integration.mjs,tests/seller-economics.test.mjs,tests/openclaw-tool-budget.test.mjs   M08 component evidence only; backlog:PRD-0039

  `PRD-0040`    P2         §25      `DEFERRED_VERIFICATION`   packages/persistence/src/provider-usage.ts,packages/application/src/seller-economics.ts,runtime/openclaw/plugin/tool-budget.mjs   tests/m06-postgres-integration.mjs,tests/seller-economics.test.mjs,tests/openclaw-tool-budget.test.mjs   M08 component evidence only; backlog:PRD-0040

  `PRD-0041`    P2         §25      `DEFERRED_VERIFICATION`   packages/persistence/src/provider-usage.ts,packages/application/src/seller-economics.ts,runtime/openclaw/plugin/tool-budget.mjs   tests/m06-postgres-integration.mjs,tests/seller-economics.test.mjs,tests/openclaw-tool-budget.test.mjs   M08 component evidence only; backlog:PRD-0041

  `PRD-0042`    P2         §25      `DEFERRED_VERIFICATION`   packages/persistence/src/provider-usage.ts,packages/application/src/seller-economics.ts,runtime/openclaw/plugin/tool-budget.mjs   tests/m06-postgres-integration.mjs,tests/seller-economics.test.mjs,tests/openclaw-tool-budget.test.mjs   M08 component evidence only; backlog:PRD-0042

  `AVL-0001`    P1         §26      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts,apps/web/app/capabilities,apps/web/app/buyer,apps/worker/src/availability-reporter.ts   tests/m09-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-busy-capacity.md   M16 authentic paid Worker and buyer browser prove one-slot BUSY/queued admission; PostgreSQL proves offline and unrealistic immediate quote denial; seller browser proves pause.

  `AVL-0002`    P1         §26      `VERIFIED`   packages/persistence/src/availability.ts,packages/persistence/src/marketplace-buyer.ts,apps/web/src/buyer-api/handler.ts   tests/m13-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-availability-admission-review.md   Real buyer REST rejects immediate paid purchase while the Worker is offline or the seller schedule is closed; no credit reservation remains. The installed Worker paid path admits only after an online server quote.

  `WRK-0048`    P1         §27      `TODO`   ---              ---        ---

  `WRK-0049`    P1         §27      `TODO`   ---              ---        ---

  `WRK-0050`    P1         §27      `TODO`   ---              ---        ---

  `WRK-0051`    P1         §27      `TODO`   ---              ---        ---

  `PRD-0043` P1 §28 `VERIFIED` packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-buyer.ts,apps/web/app/discover,apps/web/app/capabilities,apps/web/app/buyer tests/browser-m10/marketplace.spec.ts,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-authentic-browser-review.md Original §28 reviewed: authentic marketplace card/detail, seller/review/price/availability, buyer submit, durable queued/running/completed states and private rendered/downloadable result. Browser M10 and installed paid development-credit E2E pass; Stripe acceptance is separate.

  `OBS-0001`    P1         §29      `VERIFIED`   packages/persistence/src/platform-operations.ts,packages/persistence/src/seller-operations.ts,packages/persistence/migrations/0025_operations.sql   tests/m15-postgres-integration.mjs,tests/m12-postgres-integration.mjs   Bounded append-only job/finance/operator events; buyer-input sentinel absent from audit and metrics.

  `OBS-0002`    P2         §29      `VERIFIED`   packages/persistence/src/platform-operations.ts,packages/persistence/src/seller-operations.ts,packages/persistence/migrations/0025_operations.sql   tests/m15-postgres-integration.mjs,tests/m12-postgres-integration.mjs   Bounded append-only job/finance/operator events; buyer-input sentinel absent from audit and metrics.

  `OBS-0003`    P2         §29      `VERIFIED`   packages/persistence/src/platform-operations.ts,packages/persistence/src/seller-operations.ts,packages/persistence/migrations/0025_operations.sql   tests/m15-postgres-integration.mjs,tests/m12-postgres-integration.mjs   Bounded append-only job/finance/operator events; buyer-input sentinel absent from audit and metrics.

  `SEC-0032`    P1         §30      `VERIFIED`   packages/persistence/src/platform-operations.ts,packages/persistence/src/availability.ts,packages/persistence/src/job-execution.ts   tests/m15-postgres-integration.mjs,tests/m09-postgres-integration.mjs,tests/m07-postgres-integration.mjs   Durable quote/booking/spend limits, denylist, report/suspend/revoke and row-locked dispatch halt; no LLM authority.

  `SEC-0033`    P0         §30      `VERIFIED`   packages/persistence/src/platform-operations.ts,packages/persistence/src/availability.ts,packages/persistence/src/job-execution.ts   tests/m15-postgres-integration.mjs,tests/m09-postgres-integration.mjs,tests/m07-postgres-integration.mjs   Durable quote/booking/spend limits, denylist, report/suspend/revoke and row-locked dispatch halt; no LLM authority.

  `SEC-0034`    P0         §30      `VERIFIED`   packages/persistence/src/platform-operations.ts,packages/persistence/src/availability.ts,packages/persistence/src/job-execution.ts   tests/m15-postgres-integration.mjs,tests/m09-postgres-integration.mjs,tests/m07-postgres-integration.mjs   Durable quote/booking/spend limits, denylist, report/suspend/revoke and row-locked dispatch halt; no LLM authority.

  `IO-0007` P1 §31 `VERIFIED` apps/web/app/discover/safe-result.tsx,apps/web/src/buyer-api/handler.ts,apps/worker/src/output-upload.ts,packages/infrastructure/s3/src/storage.ts,packages/persistence/src/job-execution.ts tests/m16-installed-worker-e2e.mjs,tests/m15-clamav-live.test.mjs,tests/m15-result-safety.test.mjs,tests/browser-m10/marketplace.spec.ts Installed paid Worker E2E delivers two private files through the actual local ClamAV service, authenticated buyer download and one settlement; live EICAR output is rejected before manifest/earning and releases credits. Scanner outage retains an unsettled durable outbox until recovery; text/URL rendering, MIME, extension, size, count and safe download boundaries have component/browser tests.

  `IO-0008`     P1         §31      `VERIFIED`   packages/application/src/result-file-safety.ts,apps/web/src/marketplace/handler.ts,apps/web/src/buyer-api/handler.ts   tests/m15-result-safety.test.mjs,tests/m10-postgres-integration.mjs,tests/m13-postgres-integration.mjs   Safe text/URL rendering and authenticated attachment access; no server-side output execution or automatic URL fetching.

  `IO-0009`     P1         §31      `VERIFIED`   packages/application/src/result-file-safety.ts,apps/web/src/marketplace/handler.ts,apps/web/src/buyer-api/handler.ts   tests/m15-result-safety.test.mjs,tests/m10-postgres-integration.mjs,tests/m13-postgres-integration.mjs   Safe text/URL rendering and authenticated attachment access; no server-side output execution or automatic URL fetching.

  `CAP-0002`    P1         §32      `VERIFIED`   apps/worker/src/capability-package-store.ts,apps/worker/src/import-review-runner.ts,packages/persistence/src/seller-publication.ts,apps/web/app/seller/seller-publication.tsx,apps/web/app/seller/seller-visibility-control.tsx   tests/m16-core-worker-integration.mjs,tests/m16-installed-worker-e2e.mjs,tests/m10-postgres-integration.mjs,docs/evidence/m16-private-version-file-e2e.md   Real changed-skill v2→v3 representative Docker/OpenClaw review reruns; exact skill, image, policy, inference/dependency and package hashes are frozen; seller Web reapproves the new version and stale skill bytes cannot install.

  `CAP-0003`    P1         §32      `VERIFIED`   apps/worker/src/capability-package-store.ts,apps/worker/src/execution-runtime.ts,packages/openclaw-adapter/src/image-approval.ts   tests/m16-installed-worker-e2e.mjs,tests/worker-package-store.test.mjs,tests/openclaw-image-approval.test.mjs,docs/evidence/m16-boundaries.json   Reviewed package hash, OpenClaw range, inference-config hash, dependencies and exact selected skill bytes survive local store reopen and Worker process restart before paid Docker/OpenClaw execution; changed skill/image/source fail closed.

  `CAP-0004`    P1         §32      `VERIFIED`   apps/worker/src/capability-package-store.ts,apps/worker/src/import-review-runner.ts,packages/persistence/src/seller-publication.ts,apps/web/app/seller/seller-publication.tsx,apps/web/app/seller/seller-visibility-control.tsx   tests/m16-core-worker-integration.mjs,tests/m16-installed-worker-e2e.mjs,tests/m10-postgres-integration.mjs,docs/evidence/m16-private-version-file-e2e.md   Paid v2 remote-model job/result and immutable package/processor snapshot survive v3 changed-skill/local-model publication; paid v3 uses its distinct approved bytes and buyer-visible terms.

  `SEC-0035`    P1         §33      `VERIFIED`   packages/openclaw-adapter/src,packages/policy-engine/src,apps/worker/src/execution-supervisor.ts   tests/openclaw-job-config.test.mjs,tests/docker-openclaw-exec-local-integration.mjs   Marketplace runtime imports selected sandbox-safe skills only; native host plugins have no import path.

  `WRK-0052`    P1         §34      `DEFERRED_VERIFICATION`   apps/worker/src/execution-runtime.ts,packages/sandbox-adapter/src/docker.ts,docs/evidence/m16-attack-matrix.md   docs/evidence/m16-boundaries.json,tests/docker-worker-supervisor-local-integration.mjs,tests/docker-sandbox-resources-local-integration.mjs   Every listed local malicious operation has mapped technical evidence; independent Docker/runtime escape and external public-beta red-team review remain. backlog:WRK-0052

  `OBS-0004`    P1         §35      `VERIFIED`   packages/persistence/src/platform-operations.ts,packages/persistence/src/seller-operations.ts,apps/worker/src/health.ts   tests/m15-postgres-integration.mjs,tests/m12-postgres-integration.mjs,tests/m12-local-control.test.mjs   Thirty-day cloud metrics and local Worker health derive from state, with missing samples unknown and no raw job content.

  `JOB-0026`    P1         §36      `VERIFIED`   apps/worker/src/execution-supervisor.ts,packages/persistence/src/job-execution.ts,packages/sandbox-adapter/src/docker.ts   tests/m16-installed-worker-e2e.mjs,tests/docker-sandbox-output-local-integration.mjs   Paid Worker crash, lease release, restart cleanup and OpenClaw failure; bounded stderr metadata; sandbox/network/secret fail-closed tests. docs/evidence/m16-health-trust-review.md.

  `JOB-0027`    P1         §36      `VERIFIED`   packages/persistence/src/job-execution.ts,apps/worker/src/execution-supervisor.ts,apps/worker/src/health.ts   tests/m07-postgres-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs,tests/m12-local-control.test.mjs   Worker loss/crash, sandbox/network denial and missing-secret readiness follow explicit fail-closed paths; no host fallback.

  `JOB-0028`    P1         §36      `VERIFIED`   packages/persistence/src/job-execution.ts,apps/worker/src/execution-supervisor.ts,apps/worker/src/health.ts   tests/m07-postgres-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs,tests/m12-local-control.test.mjs   Worker loss/crash, sandbox/network denial and missing-secret readiness follow explicit fail-closed paths; no host fallback.

  `JOB-0029`    P1         §36      `VERIFIED`   packages/persistence/src/job-execution.ts,apps/worker/src/execution-supervisor.ts,apps/worker/src/health.ts   tests/m07-postgres-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs,tests/m12-local-control.test.mjs   Worker loss/crash, sandbox/network denial and missing-secret readiness follow explicit fail-closed paths; no host fallback.

  `JOB-0030`    P1         §36      `VERIFIED`   packages/persistence/src/job-execution.ts,apps/worker/src/execution-supervisor.ts,apps/worker/src/health.ts   tests/m07-postgres-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs,tests/m12-local-control.test.mjs   Worker loss/crash, sandbox/network denial and missing-secret readiness follow explicit fail-closed paths; no host fallback.

  `JOB-0031`    P1         §36      `VERIFIED`   packages/persistence/src/job-execution.ts,apps/worker/src/execution-supervisor.ts,apps/worker/src/health.ts   tests/m07-postgres-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs,tests/m12-local-control.test.mjs   Worker loss/crash, sandbox/network denial and missing-secret readiness follow explicit fail-closed paths; no host fallback.

  `PRD-0044`    P1         §37      `VERIFIED`   apps/worker/src/import-review.ts,packages/persistence/src/seller-publication.ts,apps/web/app/capabilities/[slug]/page.tsx   tests/seller-publication-contract.test.mjs,tests/m16-core-worker-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-authentic-browser-review.md   Authenticated seller Web publication binds the remote provider declaration to a paid Docker/OpenClaw broker route; the buyer sees that declaration and all §37 seller-machine, retention and temporary-storage disclosures. The later local-model version declares no external processor, with immutable prior snapshot.

  `PRD-0045`    P2         §37      `VERIFIED`   apps/web/app/capabilities/[slug]/page.tsx,apps/web/app/privacy/page.tsx,packages/persistence/src/marketplace-catalog.ts   tests/browser-m10/marketplace.spec.ts,tests/browser-m10/design-system.spec.ts   Capability detail discloses seller-machine execution, input processing, retention/storage and declared external processors; unknown blocks purchase.

  `PRD-0046`    P2         §37      `VERIFIED`   apps/worker/src/import-review.ts,packages/persistence/src/seller-publication.ts,apps/web/app/capabilities/[slug]/page.tsx   tests/seller-publication-contract.test.mjs,tests/m16-core-worker-integration.mjs,tests/m16-installed-worker-e2e.mjs   Remote provider mismatch fails review; seller explicitly approves remote v2 and local v3 in Web; published v2 declaration remains immutable; each actual broker route matches its buyer-visible version.

  `PRD-0047`    P1         §38      `DEFERRED_VERIFICATION`   docs/operations-m15.md,apps/web/app/privacy/page.tsx,apps/web/app/marketplace-terms/page.tsx   tests/browser-m10/design-system.spec.ts   Prelaunch legal/product review plan documented; professional legal review and public-onboarding decision remain external. backlog:PRD-0047

  `PRD-0048`    P1         §39      `DEFERRED_VERIFICATION`   apps/worker/src/execution-runtime.ts,packages/persistence/src/seller-publication.ts,docs/milestones/M16.md   tests/m16-installed-worker-e2e.mjs,tests/m14-publication-postgres-integration.mjs   Host-native Worker, publication repository and development-credit paid E2E now exist. The whole roadmap still needs actual seller alpha, live personal-state attribution, real Stripe staging and later signed-update/deployment evidence. backlog:PRD-0048

  `WRK-0053`    P1         §40      `DEFERRED_VERIFICATION` README.md,packages/ tests/architecture.test.mjs skeleton only backlog:WRK-0053 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `PRD-0049`    P1         §41      `VERIFIED`   apps/web/src/buyer-api/handler.ts,apps/web/src/marketplace/handler.ts,apps/web/src/seller/publication-handler.ts,apps/web/src/seller/pairing-handler.ts,apps/web/app/api/seller/capabilities/,apps/web/app/api/seller/worker-devices/[deviceId]/revoke/route.ts,apps/web/src/worker/control-handler.ts   tests/m13-postgres-integration.mjs,tests/m14-publication-postgres-integration.mjs,tests/seller-pairing-handler.test.mjs,tests/m07-postgres-integration.mjs   The versioned buyer API, seller draft/publish/pause, credit checkout, pair/revoke and separate signed Worker protocol are reachable; seller create requires an exact staged Worker review, revoke requires the owning session and same origin.

  `PRD-0050`    P2         §41      `VERIFIED`   packages/worker-protocol/src/auth.ts,packages/persistence/src/worker-auth.ts,apps/web/src/worker/control-handler.ts   tests/m07-postgres-integration.mjs,tests/m13-postgres-integration.mjs   Worker Ed25519 device protocol is separate from buyer/seller endpoints; forged signed job RPC is denied.

  `CAP-0005`    P1         §42      `DEFERRED`   spec/MASTER-SPEC.md §42   spec/MASTER-SPEC.md §42   Marketplace MCP is explicitly post-MVP; shared Core/REST contracts preserve a future adapter.

  `CAP-0006`    P1         §42      `DEFERRED`   spec/MASTER-SPEC.md §42   spec/MASTER-SPEC.md §42   Spec explicitly says external Marketplace MCP/API is not required for MVP; architecture remains port-based.

  `CAP-0007`    P1         §42      `DEFERRED`   spec/MASTER-SPEC.md §42   spec/MASTER-SPEC.md §42   Future external-agent interface follows a proven human-driven paid web job, which is not yet complete.

  `SEC-0036`    P1         §43      `VERIFIED`   docs/openclaw-m16-compatibility-review.md,runtime/openclaw/Dockerfile,packages/openclaw-adapter/src   tests/docker-openclaw-exec-local-integration.mjs,tests/openclaw-image-approval.test.mjs,tests/openclaw-discovery.test.mjs   Official current agent/config/skills/sandbox/exec/trust docs reviewed against pinned 2026.8.2; version changes require fresh conformance, and personal discovery remains read-only.

  `SEC-0037`    P0         §43      `VERIFIED`   docs/openclaw-m16-compatibility-review.md,runtime/openclaw/Dockerfile,packages/openclaw-adapter/src   tests/docker-openclaw-exec-local-integration.mjs,tests/openclaw-image-approval.test.mjs,tests/openclaw-discovery.test.mjs   Official current agent/config/skills/sandbox/exec/trust docs reviewed against pinned 2026.8.2; version changes require fresh conformance, and personal discovery remains read-only.

  `SEC-0038`    P1         §44      `DEFERRED_VERIFICATION`   packages/openclaw-adapter/src/read-only-discovery.ts,apps/worker/src/execution-runtime.ts,docs/evidence/m16-attack-matrix.md   tests/m16-installed-worker-e2e.mjs,tests/docker-sandbox-local-integration.mjs,tests/m06-postgres-integration.mjs,tools/test-openclaw-readonly-live.mjs   Experiments B–G have real local evidence; A requires a quiesced personal OpenClaw installation because an ambient Codex WAL writer prevents trustworthy non-mutation attribution. backlog:SEC-0038

  `SEC-0039`    P0         §44      `VERIFIED`   packages/openclaw-adapter/src/worker-environment.ts,apps/worker/src/local-state.ts   tests/worker-environment.test.mjs,tests/openclaw-discovery.test.mjs   A separate empty state/config/workspace is generated; personal-state sentinel remains byte-identical and no personal session/secret is copied.

  `SEC-0040`    P0         §44      `VERIFIED`   packages/sandbox-adapter/src/docker.ts,packages/policy-engine/src/sandbox.ts   tests/docker-sandbox-local-integration.mjs,tests/docker-openclaw-exec-local-integration.mjs   Real Docker network=none and effective container inspection deny public IP, localhost, LAN and metadata probes; no network fallback.

  `SEC-0041`    P0         §44      `VERIFIED`   packages/application/src/local-resource-broker.ts,packages/persistence/src/postgres-readonly-resource.ts   tests/m06-postgres-integration.mjs   Synthetic seller_public.company SELECT succeeds only for approved row; seller_private.secrets and writes are denied by PostgreSQL role.

  `PRD-0051`    P1         §45      `DEFERRED_VERIFICATION`   packages/persistence/src/seller-publication.ts,apps/worker/src/execution-runtime.ts,docs/milestones/M16.md   tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-browser   Authenticated seller confirmation/publication, buyer Web upload/quote, paid Worker execution, buyer result/download and one development-credit settlement pass; the complete 18-step staging chain still lacks Stripe test funding, supported Worker install and quiesced personal-state evidence. backlog:PRD-0051

  `PRD-0052`    P2         §45      `VERIFIED`   packages/sandbox-adapter/src/docker.ts,apps/worker/src/broker-router.ts,apps/worker/src/resource-ports.ts   tests/m16-installed-worker-e2e.mjs,tests/m06-postgres-integration.mjs,tests/docker-sandbox-local-integration.mjs   During a published paid job, a live sandbox probe cannot see seller state, personal OpenClaw or Docker socket; the dedicated private DB fixture permits only the reviewed operation and denies an undeclared table.

  `PRD-0053`    P2         §45      `VERIFIED`   packages/policy-engine/src/sandbox.ts,packages/sandbox-adapter/src/docker.ts,apps/worker/src/broker-router.ts   tests/m16-installed-worker-e2e.mjs,tests/docker-sandbox-local-integration.mjs,tests/worker-broker-router.test.mjs   The live paid sandbox cannot reach public Internet, localhost, seller LAN or metadata; broker admission rejects undeclared ports, so the seller machine cannot be used as a general proxy.

  `PRD-0054`    P1         §46      `DEFERRED_VERIFICATION`   spec/MASTER-SPEC.md §46   docs/milestones/M16.md   Private-alpha demand/supply/economics measurements require real external buyers and sellers after MVP release readiness; no fabricated product validation.

  `PRD-0055`    P2         §46      `DEFERRED_VERIFICATION`   spec/MASTER-SPEC.md §46   docs/milestones/M16.md   Private-alpha research needs real sellers/buyers and measured repeat demand; not a laboratory assertion.

  `PRD-0056`    P2         §46      `DEFERRED_VERIFICATION`   spec/MASTER-SPEC.md §46   docs/milestones/M16.md   Scaling decision requires an observed category with repeated paid demand, not fixture activity.

  `PRD-0057`    P1         §47      `TODO`   ---              ---        ---

  `PRD-0058`    P2         §47      `TODO`   ---              ---        ---

  `PRD-0059`    P2         §47      `TODO`   ---              ---        ---

  `PRD-0060`    P2         §47      `TODO`   ---              ---        ---

  `SEC-0042`    P1         §48      `TODO`   ---              ---        ---

  `SEC-0043`    P0         §48      `TODO`   ---              ---        ---

  `WRK-0054`    P1         §49      `OPEN_IMPLEMENTATION` packages/openclaw-adapter/src tests/openclaw-discovery.test.mjs Steps 1–4 only; execution and security proof pending backlog:WRK-0054

  `WRK-0055`    P1         §49      `VERIFIED`   packages/sandbox-adapter/src/docker.ts,packages/policy-engine/src/public-destination.ts,packages/persistence/src/finance.ts   tests/docker-sandbox-local-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs,tests/m08-finance-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs   Security-invariant tests reject host/personal state, Docker socket, forbidden tools, network/metadata, insecure payment and fallback execution; the M16 matrix runs the real paid Docker/OpenClaw attack fixture.

  `WRK-0056`    P1         §49      `OPEN_IMPLEMENTATION`   ---              ---        --- backlog:WRK-0056 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `WRK-0057`    P1         §49      `VERIFIED`   apps/worker/src/execution-runtime.ts,packages/persistence/src/job-execution.ts,packages/sandbox-adapter/src/docker.ts   tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-central-proof.md   A distinct remote buyer purchases the seller-published capability; the outbound host-native Worker executes its private input in pinned Docker/OpenClaw while paid host and personal-state access probes fail.

  `WRK-0058`    P1         §49      `VERIFIED`   apps/worker/src/broker-router.ts,packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts,packages/sandbox-adapter/src/docker.ts   tests/m16-installed-worker-e2e.mjs,tests/docker-broker-sidecar-local-integration.mjs,docs/evidence/m16-central-proof.md   The paid buyer cannot access undeclared seller resources or use the host as an unrestricted external-action proxy: real sandbox requests to public, localhost, LAN and metadata endpoints fail and only approved broker routes are exposed.

  `WRK-0059`    P1         §50      `TODO`   ---              ---        ---

  `WRK-0060`    P1         §50      `TODO`   ---              ---        ---

  `SEC-0044`    P1         §51      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0044

  `SEC-0045`    P0         §51      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0045

  `SEC-0046`    P0         §51      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0046 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `SEC-0047`    P0         §51      `DEFERRED_VERIFICATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   M06 component evidence; backlog:SEC-0047 M08 component evidence: packages/persistence/src/finance.ts,tests/m08-finance-postgres-integration.mjs; backlog:SEC-0047

  `SEC-0048` P0 §51 `VERIFIED` packages/sandbox-adapter/src/docker.ts,apps/worker/src/execution-runtime.ts,apps/worker/src/execution-supervisor.ts tests/docker-sandbox-local-integration.mjs,tests/m16-installed-worker-e2e.mjs Actual Docker adapter rejects absent daemon, unapproved or unavailable image and unsafe input; production paid Worker executes only through mandatory sandbox; no host fallback path exists.

  `SEC-0049` P0 §51 `VERIFIED` packages/sandbox-adapter/src/docker.ts,packages/openclaw-adapter/src/worker-environment.ts,apps/worker/src/execution-supervisor.ts tests/docker-sandbox-local-integration.mjs,tests/docker-openclaw-exec-local-integration.mjs,tests/m16-installed-worker-e2e.mjs Real paid sandbox has no personal OpenClaw mount or seller state; host sentinel and job directory isolation pass technical denial tests.

  `SEC-0050` P0 §51 `VERIFIED` packages/persistence/src/seller-publication.ts,apps/worker/src/runtime-readiness.ts,apps/worker/src/broker-router.ts tests/m14-publication-postgres-integration.mjs,tests/worker-broker-router.test.mjs Changed manifest/package hash or missing explicit consent rejects publication; Worker requires exact reviewed bytes and broker ports, with no runtime permission expansion.

  `SEC-0051`    P0         §51      `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/migrations/0015_finance.sql   tests/m08-finance-postgres-integration.mjs,tests/stripe-webhook.test.mjs   M08 concurrent reserve, signed replay, cancel/claim, immutable settlement/refund and transfer retry evidence; docs/milestones/M08.md

  `SEC-0052`    P0         §51      `VERIFIED`   packages/persistence/src/job-execution.ts,packages/persistence/migrations/0014_job_execution.sql,apps/worker/src/local-state.ts   tests/m07-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-job-transition-recovery.md   Durable job transitions carry actor, reason, attempt and correlation identifiers; a fresh repository reconciles persisted ownership and the installed Worker survives restart/lost finalization acknowledgement without a second execution or settlement.

  `SEC-0053`    P0         §51      `DEFERRED_VERIFICATION` docs/implementation-status.md --- ongoing status backlog:SEC-0053

  `SEC-0054`    P0         §51      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0054

  `WRK-0061`    P1         §52      `DEFERRED_VERIFICATION` packages/,apps/ tests/architecture.test.mjs no services yet backlog:WRK-0061

  `WRK-0062`    P1         §52      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0062

  `WRK-0063`    P1         §52      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0063

  `IO-0010`     P1         §53      `DEFERRED_VERIFICATION` packages/contracts/src/worker-manifest.ts tests/contracts.test.mjs boundary subset backlog:IO-0010 added:packages/contracts/src/capability-io.ts,packages/contracts/src/contract-values.ts;tests/capability-io.test.mjs M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `IO-0011`     P1         §53      `DEFERRED_VERIFICATION` packages/worker-protocol/src/messages.ts tests/contracts.test.mjs boundary subset backlog:IO-0011 added:packages/contracts/src/capability-io.ts,packages/contracts/src/contract-values.ts;tests/capability-io.test.mjs M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `IO-0012`     P1         §53      `DEFERRED_VERIFICATION` packages/contracts/src/worker-manifest.ts tests/contracts.test.mjs other boundaries pending backlog:IO-0012 added:packages/contracts/src/capability-io.ts,packages/contracts/src/contract-values.ts;tests/capability-io.test.mjs M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `CAP-0008`    P1         §54      `VERIFIED`   packages/contracts/src/worker-manifest.ts,packages/contracts/src/capability-package.ts,packages/persistence/src/seller-publication.ts,apps/worker/src/capability-package-store.ts   tests/contracts.test.mjs,tests/m14-publication-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-manifest-version-review.md   Full local Worker manifest and immutable hash are stored separately from the sanitized cloud version; installed paid v2/v3 publication and job pinning pass.

  `CAP-0009`    P1         §54      `VERIFIED`   packages/domain/src/capability-version.ts,packages/persistence/src/seller-publication.ts,packages/persistence/src/marketplace-buyer.ts   tests/m14-publication-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-manifest-version-review.md   An authenticated seller publishes a changed skill/runtime version after an earlier paid job; the old job retains its original version, package hash, processor disclosure, result and commercial snapshot.

  `WRK-0064`    P1         §55      `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/result-outbox.ts,apps/worker/src/dispatch-loop.ts,packages/persistence/src/job-execution.ts   tests/worker-dispatch-loop.test.mjs,tests/m16-installed-worker-e2e.mjs   SQLite state, process restart, lost acknowledgement and cloud reconciliation pass; real OS reboot, Docker-daemon crash and control-plane outage fault matrix remains M26. backlog:WRK-0064

  `WRK-0065`    P1         §55      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0065

  `WRK-0066`    P1         §55      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0066

  `WRK-0067`    P1         §55      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0067

  `WRK-0068`    P1         §56      `OPEN_IMPLEMENTATION`   apps/web/src/seller/pairing-handler.ts,apps/worker/src/cli.ts,tools/kivro-worker-service.mjs   tests/seller-pairing-handler.test.mjs,tests/worker-service.test.mjs,tests/worker-service-macos-local-integration.mjs   Private-alpha checkout installation and macOS background LaunchAgent pass; whole §56 still lacks a portable packaged CLI and M25 signed update/rollback acceptance. backlog:WRK-0068

  `WRK-0069`    P1         §56      `VERIFIED`   tools/kivro-worker-service.mjs,apps/worker/README.md,package.json   tests/worker-service.test.mjs,tests/worker-service-macos-local-integration.mjs   Reproducible private-alpha checkout installation is documented: install/build, pair/review, private environment, LaunchAgent install/start/status/stop/logs/uninstall. Generated plist passes plutil and private-file checks; disposable macOS launchd lifecycle passes.

  `WRK-0070`    P1         §56      `VERIFIED`   tools/kivro-worker-service.mjs,tools/kivro-worker-run.mjs   tests/worker-service.test.mjs,tests/worker-service-macos-local-integration.mjs,tests/m16-installed-worker-e2e.mjs   Per-user launchd agent starts without an attached terminal, stays alive after bootstrap and stops on bootout; it points to the same fail-closed host-native Worker entrypoint exercised by paid Docker/OpenClaw E2E.

  `WRK-0071`    P1         §57      `DEFERRED_VERIFICATION`   apps/worker/src/cli.ts,apps/worker/src/health.ts   tests/worker-cli.test.mjs,tests/m12-seller-vault.test.mjs   M12 component evidence; full gate remains OPEN; backlog:WRK-0071

  `WRK-0072`    P1         §57      `DEFERRED_VERIFICATION`   apps/worker/src/cli.ts,apps/worker/src/health.ts   tests/worker-cli.test.mjs,tests/m12-seller-vault.test.mjs   M12 component evidence; full gate remains OPEN; backlog:WRK-0072

  `WRK-0073`    P1         §57      `DEFERRED_VERIFICATION`   apps/worker/src/cli.ts,apps/worker/src/health.ts   tests/worker-cli.test.mjs,tests/m12-seller-vault.test.mjs   M12 component evidence; full gate remains OPEN; backlog:WRK-0073

  `WRK-0074`    P1         §58      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0074

  `WRK-0075`    P1         §58      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0075

  `WRK-0076`    P1         §58      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0076

  `WRK-0077`    P1         §59      `VERIFIED`   packages/openclaw-adapter/src/job-config.ts,packages/openclaw-adapter/src/image-approval.ts,apps/worker/src/execution-supervisor.ts,runtime/openclaw/runner.mjs,runtime/openclaw/plugin/index.mjs   tests/openclaw-job-config.test.mjs,tests/docker-openclaw-exec-local-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs,tests/docker-openclaw-image-local-integration.mjs   OpenClaw 2026.8.2 pinned; effective mode all, contained backend, exact image and tool policy preflight before agent exec

  `WRK-0078`    P1         §59      `VERIFIED`   packages/openclaw-adapter/src/job-config.ts,packages/openclaw-adapter/src/image-approval.ts,apps/worker/src/execution-supervisor.ts,runtime/openclaw/runner.mjs,runtime/openclaw/plugin/index.mjs   tests/openclaw-job-config.test.mjs,tests/docker-openclaw-exec-local-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs,tests/docker-openclaw-image-local-integration.mjs   OpenClaw 2026.8.2 pinned; effective mode all, contained backend, exact image and tool policy preflight before agent exec

  `WRK-0079`    P1         §59      `VERIFIED`   packages/openclaw-adapter/src/job-config.ts,packages/openclaw-adapter/src/image-approval.ts,apps/worker/src/execution-supervisor.ts,runtime/openclaw/runner.mjs,runtime/openclaw/plugin/index.mjs   tests/openclaw-job-config.test.mjs,tests/docker-openclaw-exec-local-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs,tests/docker-openclaw-image-local-integration.mjs   OpenClaw 2026.8.2 pinned; effective mode all, contained backend, exact image and tool policy preflight before agent exec

  `WRK-0080`    P1         §59      `VERIFIED`   packages/openclaw-adapter/src/job-config.ts,packages/openclaw-adapter/src/image-approval.ts,apps/worker/src/execution-supervisor.ts,runtime/openclaw/runner.mjs,runtime/openclaw/plugin/index.mjs   tests/openclaw-job-config.test.mjs,tests/docker-openclaw-exec-local-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs,tests/docker-openclaw-image-local-integration.mjs   OpenClaw 2026.8.2 pinned; effective mode all, contained backend, exact image and tool policy preflight before agent exec

  `WRK-0081`    P1         §59      `VERIFIED`   packages/openclaw-adapter/src/job-config.ts,packages/openclaw-adapter/src/image-approval.ts,apps/worker/src/execution-supervisor.ts,runtime/openclaw/runner.mjs,runtime/openclaw/plugin/index.mjs   tests/openclaw-job-config.test.mjs,tests/docker-openclaw-exec-local-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs,tests/docker-openclaw-image-local-integration.mjs   OpenClaw 2026.8.2 pinned; effective mode all, contained backend, exact image and tool policy preflight before agent exec

  `JOB-0032`    P1         §60      `VERIFIED`   packages/sandbox-adapter/src/docker.ts,apps/worker/src/execution-supervisor.ts   tests/docker-sandbox-local-integration.mjs,tests/docker-sandbox-output-local-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-job-layout-review.md   Complete §60 review: unique paid attempts, exact read-only input bind, ephemeral work/output, output-only collector, no metadata/parent bind and terminal cleanup pass real Docker; no cryptographic SSD deletion claim.

  `JOB-0033`    P1         §60      `VERIFIED`   packages/sandbox-adapter/src/docker.ts   tests/docker-sandbox-local-integration.mjs,docs/evidence/m16-job-layout-review.md   Live unprivileged Docker process cannot write /job/input; effective mount inspection requires RW=false.

  `JOB-0034`    P1         §60      `VERIFIED`   packages/sandbox-adapter/src/docker.ts   tests/docker-sandbox-local-integration.mjs,tests/docker-sandbox-output-local-integration.mjs,docs/evidence/m16-job-layout-review.md   Work/output tmpfs are writable; only the stopped output volume is visible to the read-only collector and eligible for result collection; unsafe paths and symlinks fail.

  `JOB-0035`    P1         §60      `VERIFIED`   packages/sandbox-adapter/src/docker.ts   tests/docker-sandbox-local-integration.mjs,docs/evidence/m16-job-layout-review.md   Live container observes no /job/metadata; exact effective mount count excludes a metadata bind.

  `JOB-0036`    P1         §60      `VERIFIED`   packages/sandbox-adapter/src/docker.ts   tests/docker-sandbox-local-integration.mjs,docs/evidence/m16-job-layout-review.md   Exact mount count/source validation prohibits parent runtime bind; live parent-tree sentinel is inaccessible to the sandbox.

  `JOB-0037`    P1         §60      `VERIFIED`   packages/sandbox-adapter/src/docker.ts,apps/worker/src/execution-supervisor.ts   tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-job-layout-review.md   Temporary attempts and output tmpfs are removed after terminal processing; documentation explicitly disclaims cryptographic secure deletion on SSD/object media.

  `IO-0013` P1 §61 `VERIFIED` packages/persistence/src/marketplace-assets.ts,packages/persistence/src/job-execution.ts,apps/worker/src/input-staging.ts,apps/worker/src/output-upload.ts,packages/sandbox-adapter/src/docker.ts tests/m13-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,tests/input-staging.test.mjs,tests/docker-sandbox-output-local-integration.mjs,docs/evidence/m16-file-pipeline-review.md Original §61 reviewed: real browser signed upload/finalize, ClamAV input scan, secured-credit paid Worker Docker/OpenClaw download, validated isolated output, private object storage and authorized browser/API downloads. Stripe purchase remains a distinct release gate.

  `IO-0014` P1 §61 `VERIFIED` packages/persistence/src/marketplace-assets.ts,packages/persistence/src/job-execution.ts,apps/worker/src/input-staging.ts,apps/worker/src/output-upload.ts,packages/sandbox-adapter/src/docker.ts tests/m13-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,tests/input-staging.test.mjs,tests/docker-sandbox-output-local-integration.mjs,docs/evidence/m16-file-pipeline-review.md Original §61 reviewed: real browser signed upload/finalize, ClamAV input scan, secured-credit paid Worker Docker/OpenClaw download, validated isolated output, private object storage and authorized browser/API downloads. Stripe purchase remains a distinct release gate.

  `IO-0015`     P1         §61      `VERIFIED`   apps/worker/src/input-staging.ts,apps/worker/src/output-upload.ts,packages/persistence/src/marketplace-assets.ts,packages/persistence/src/job-execution.ts   docs/evidence/m16-file-pipeline-review.md,docs/evidence/m16-boundaries.json,tests/m13-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs   Original §61 rule reviewed individually; production boundary and executable evidence are itemized in m16-file-pipeline-review.md.

  `IO-0016`     P1         §61      `VERIFIED`   apps/worker/src/input-staging.ts,apps/worker/src/output-upload.ts,packages/persistence/src/marketplace-assets.ts,packages/persistence/src/job-execution.ts   docs/evidence/m16-file-pipeline-review.md,docs/evidence/m16-boundaries.json,tests/m13-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs   Original §61 rule reviewed individually; production boundary and executable evidence are itemized in m16-file-pipeline-review.md.

  `IO-0017`     P1         §61      `VERIFIED`   apps/worker/src/input-staging.ts,apps/worker/src/output-upload.ts,packages/persistence/src/marketplace-assets.ts,packages/persistence/src/job-execution.ts   docs/evidence/m16-file-pipeline-review.md,docs/evidence/m16-boundaries.json,tests/m13-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs   Original §61 rule reviewed individually; production boundary and executable evidence are itemized in m16-file-pipeline-review.md.

  `IO-0018`     P1         §61      `VERIFIED`   apps/worker/src/input-staging.ts,apps/worker/src/output-upload.ts,packages/persistence/src/marketplace-assets.ts,packages/persistence/src/job-execution.ts   docs/evidence/m16-file-pipeline-review.md,docs/evidence/m16-boundaries.json,tests/m13-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs   Original §61 rule reviewed individually; production boundary and executable evidence are itemized in m16-file-pipeline-review.md.

  `IO-0019`     P1         §61      `VERIFIED`   apps/worker/src/input-staging.ts,apps/worker/src/output-upload.ts,packages/persistence/src/marketplace-assets.ts,packages/persistence/src/job-execution.ts   docs/evidence/m16-file-pipeline-review.md,docs/evidence/m16-boundaries.json,tests/m13-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs   Original §61 rule reviewed individually; production boundary and executable evidence are itemized in m16-file-pipeline-review.md.

  `IO-0020`     P1         §61      `VERIFIED`   apps/worker/src/input-staging.ts,apps/worker/src/output-upload.ts,packages/persistence/src/marketplace-assets.ts,packages/persistence/src/job-execution.ts   docs/evidence/m16-file-pipeline-review.md,docs/evidence/m16-boundaries.json,tests/m13-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs   Original §61 rule reviewed individually; production boundary and executable evidence are itemized in m16-file-pipeline-review.md.

  `IO-0021`     P1         §61      `VERIFIED`   apps/worker/src/input-staging.ts,apps/worker/src/output-upload.ts,packages/persistence/src/marketplace-assets.ts,packages/persistence/src/job-execution.ts   docs/evidence/m16-file-pipeline-review.md,docs/evidence/m16-boundaries.json,tests/m13-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs   Original §61 rule reviewed individually; production boundary and executable evidence are itemized in m16-file-pipeline-review.md.

  `IO-0022`     P1         §61      `VERIFIED`   apps/worker/src/input-staging.ts,apps/worker/src/output-upload.ts,packages/persistence/src/marketplace-assets.ts,packages/persistence/src/job-execution.ts   docs/evidence/m16-file-pipeline-review.md,docs/evidence/m16-boundaries.json,tests/m13-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs   Original §61 rule reviewed individually; production boundary and executable evidence are itemized in m16-file-pipeline-review.md.

  `IO-0023`     P1         §61      `VERIFIED`   apps/worker/src/input-staging.ts,apps/worker/src/output-upload.ts,packages/persistence/src/marketplace-assets.ts,packages/persistence/src/job-execution.ts   docs/evidence/m16-file-pipeline-review.md,docs/evidence/m16-boundaries.json,tests/m13-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs   Original §61 rule reviewed individually; production boundary and executable evidence are itemized in m16-file-pipeline-review.md.

  `IO-0024`     P1         §61      `VERIFIED`   apps/worker/src/input-staging.ts,apps/worker/src/output-upload.ts,packages/persistence/src/marketplace-assets.ts,packages/persistence/src/job-execution.ts   docs/evidence/m16-file-pipeline-review.md,docs/evidence/m16-boundaries.json,tests/m13-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs   Original §61 rule reviewed individually; production boundary and executable evidence are itemized in m16-file-pipeline-review.md.

  `IO-0025`     P1         §61      `VERIFIED`   apps/worker/src/input-staging.ts,apps/worker/src/output-upload.ts,packages/persistence/src/marketplace-assets.ts,packages/persistence/src/job-execution.ts   docs/evidence/m16-file-pipeline-review.md,docs/evidence/m16-boundaries.json,tests/m13-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs   Original §61 rule reviewed individually; production boundary and executable evidence are itemized in m16-file-pipeline-review.md.

  `IO-0026`     P1         §61      `VERIFIED`   apps/worker/src/input-staging.ts,apps/worker/src/output-upload.ts,packages/persistence/src/marketplace-assets.ts,packages/persistence/src/job-execution.ts   docs/evidence/m16-file-pipeline-review.md,docs/evidence/m16-boundaries.json,tests/m13-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs   Original §61 rule reviewed individually; production boundary and executable evidence are itemized in m16-file-pipeline-review.md.

  `IO-0027`     P1         §61      `VERIFIED`   apps/worker/src/input-staging.ts,apps/worker/src/output-upload.ts,packages/persistence/src/marketplace-assets.ts,packages/persistence/src/job-execution.ts   docs/evidence/m16-file-pipeline-review.md,docs/evidence/m16-boundaries.json,tests/m13-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs   Original §61 rule reviewed individually; production boundary and executable evidence are itemized in m16-file-pipeline-review.md.

  `IO-0028`     P1         §61      `VERIFIED`   apps/worker/src/input-staging.ts,apps/worker/src/output-upload.ts,packages/persistence/src/marketplace-assets.ts,packages/persistence/src/job-execution.ts   docs/evidence/m16-file-pipeline-review.md,docs/evidence/m16-boundaries.json,tests/m13-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs   Original §61 rule reviewed individually; production boundary and executable evidence are itemized in m16-file-pipeline-review.md.

  `IO-0029`     P1         §62      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:IO-0029

  `IO-0030`     P1         §62      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:IO-0030

  `IO-0031`     P1         §62      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:IO-0031

  `IO-0032`     P1         §62      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:IO-0032

  `IO-0033`     P1         §63      `OPEN_IMPLEMENTATION`   ---              ---        --- backlog:IO-0033

  `IO-0034`     P1         §63      `OPEN_IMPLEMENTATION`   ---              ---        --- backlog:IO-0034

  `JOB-0038`    P1         §64      `VERIFIED`   packages/persistence/src/job-execution.ts,apps/web/app/buyer/jobs/[id]/page.tsx,apps/web/app/discover/marketplace-ui.tsx   tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-progress-privacy.md   Real paid Worker stages and separate completed/failed buyer views use persisted lifecycle events only; no internal stream or invented progress is shown.

  `JOB-0039`    P1         §64      `VERIFIED`   apps/web/app/buyer/jobs/[id]/page.tsx,packages/persistence/src/job-execution.ts   tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-progress-privacy.md   The full local paid job succeeds without token streaming; the buyer sees durable stage events and final validated output.

  `JOB-0040`    P1         §64      `VERIFIED`   apps/web/app/buyer/jobs/[id]/page.tsx,packages/persistence/src/job-execution.ts   tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-progress-privacy.md   Paid OpenClaw tool activity remains Worker-local; buyer progress is persisted status only, with no chain-of-thought or model token stream.

  `JOB-0041`    P1         §64      `VERIFIED`   apps/web/app/buyer/jobs/[id]/page.tsx,packages/persistence/src/job-execution.ts   tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-progress-privacy.md   Browser E2E asserts real tool names and internal call metadata are absent while paid job runs; progress UI contains only sanitized persisted states and no secret/tool log feed.

  `PRD-0061`    P1         §65      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0061

  `PRD-0062`    P2         §65      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0062

  `WRK-0082`    P1         §66      `OPEN_IMPLEMENTATION`   ---              ---        --- backlog:WRK-0082 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `WRK-0083`    P1         §66      `VERIFIED`   apps/web/src/buyer-api/handler.ts,packages/persistence/src/marketplace-buyer.ts   tests/m13-postgres-integration.mjs   Cross-buyer job and output-asset reads are denied by server-derived buyer identity.

  `WRK-0084`    P1         §66      `OPEN_IMPLEMENTATION`   ---              ---        --- backlog:WRK-0084 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `WRK-0085`    P1         §66      `OPEN_IMPLEMENTATION`   ---              ---        --- backlog:WRK-0085 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `WRK-0086`    P1         §66      `OPEN_IMPLEMENTATION`   ---              ---        --- backlog:WRK-0086 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `WRK-0087`    P1         §66      `OPEN_IMPLEMENTATION`   ---              ---        --- backlog:WRK-0087 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `WRK-0088`    P1         §66      `OPEN_IMPLEMENTATION`   ---              ---        --- backlog:WRK-0088 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `WRK-0089`    P1         §66      `OPEN_IMPLEMENTATION`   ---              ---        --- backlog:WRK-0089 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `WRK-0090`    P1         §66      `OPEN_IMPLEMENTATION`   ---              ---        --- backlog:WRK-0090 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `WRK-0091`    P1         §67      `OPEN_IMPLEMENTATION`   apps/worker/src/device-identity.ts   tests/device-identity.test.mjs   Persistent Ed25519 keychain primary plus explicit encrypted fallback; cloud pairing/revoke/rotation absent backlog:WRK-0091

  `WRK-0092`    P1         §67      `OPEN_IMPLEMENTATION`   ---              ---        --- backlog:WRK-0092

  `CAP-0010`    P1         §68      `VERIFIED`   packages/worker-protocol/src/messages.ts,apps/worker/src/job-admission.ts,apps/worker/src/dispatch-loop.ts,packages/persistence/src/job-execution.ts   tests/contracts.test.mjs,tests/worker-admission.test.mjs,tests/worker-dispatch-loop.test.mjs,tests/m07-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-job-message-authenticity.md   Original §68 offer identity, expiry, protocol, consumed attempt and duplicate finalization rules pass across Worker admission, PostgreSQL and signed installed execution.

  `CAP-0011`    P1         §68      `VERIFIED`   packages/worker-protocol/src/messages.ts,packages/persistence/src/job-execution.ts   tests/contracts.test.mjs,tests/m07-postgres-integration.mjs,docs/evidence/m16-job-message-authenticity.md   Strict offer schema and persisted Core offer require job, attempt, device, capability version, expiry, message ID and protocol version.

  `CAP-0012`    P1         §68      `VERIFIED`   apps/worker/src/job-admission.ts,apps/worker/src/dispatch-loop.ts,packages/worker-protocol/src/messages.ts   tests/worker-admission.test.mjs,tests/worker-dispatch-loop.test.mjs,tests/contracts.test.mjs,docs/evidence/m16-job-message-authenticity.md   Worker refuses foreign device/plane, expired or repeated offer, incompatible protocol and changed capability version before execution.

  `CAP-0013`    P1         §68      `VERIFIED`   packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m07-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-job-message-authenticity.md   Duplicate finalization after lost acknowledgement and Worker restart leaves one private result manifest and one settlement journal.

  `JOB-0042`    P1         §69      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:JOB-0042 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0043`    P1         §69      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:JOB-0043 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0044`    P1         §70     `DEFERRED_VERIFICATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:JOB-0044

  `JOB-0045`    P1         §70     `DEFERRED_VERIFICATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:JOB-0045

  `JOB-0046`    P1         §70     `DEFERRED_VERIFICATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:JOB-0046

  `JOB-0047`    P1         §70     `DEFERRED_VERIFICATION`   packages/sandbox-adapter/src/docker.ts tests/docker-sandbox-local-integration.mjs offline canary only; backlog:JOB-0047

  `SEC-0055`    P1         §71     `OPEN_IMPLEMENTATION`   packages/application/src/local-resource-broker.ts,packages/persistence/src/postgres-readonly-resource.ts,apps/worker/src/broker-router.ts   tests/m06-postgres-integration.mjs,tests/worker-broker-router.test.mjs   Named read-only broker and exact-port admission pass component tests; seller authoring, private binding and real Worker composition remain; backlog:SEC-0055

  `SEC-0056` P0 §71 `VERIFIED` packages/application/src/local-resource-broker.ts,packages/persistence/src/postgres-readonly-resource.ts,apps/worker/src/broker-router.ts,apps/worker/src/execution-runtime.ts tests/m06-postgres-integration.mjs,tests/worker-broker-router.test.mjs,docs/evidence/m16-database-boundary.md Original §71 reviewed: seller-selected named read-only operation passes actual pinned Docker/OpenClaw through the host Worker broker and dedicated PostgreSQL role; raw password, arbitrary SQL, sibling/private tables and privileged credentials are denied; authenticated seller publication and buyer redaction pass.

  `SEC-0057`    P1         §72     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   M06 component evidence; backlog:SEC-0057

  `SEC-0058` P0 §72 `VERIFIED` packages/sandbox-adapter/src/docker.ts,apps/worker/src/broker-sidecar.ts,apps/worker/src/broker-router.ts,packages/application/src/completion-broker.ts,packages/application/src/research-broker.ts tests/docker-broker-sidecar-local-integration.mjs,tests/docker-openclaw-exec-local-integration.mjs,tests/m16-installed-worker-e2e.mjs,tests/research-broker.test.mjs,docs/evidence/m16-network-broker-review.md Original §72 reviewed: real pinned Docker/OpenClaw network=none denies direct Internet/LAN/metadata; only authenticated job-scoped broker calls can reach host-side provider/research/API ports under declared limits and audit. The private unbrokered spike exception was not used.

  `SEC-0059` P0 §72 `VERIFIED` packages/sandbox-adapter/src/docker.ts,apps/worker/src/broker-sidecar.ts,apps/worker/src/broker-router.ts,packages/application/src/completion-broker.ts,packages/application/src/research-broker.ts tests/docker-broker-sidecar-local-integration.mjs,tests/docker-openclaw-exec-local-integration.mjs,tests/m16-installed-worker-e2e.mjs,tests/research-broker.test.mjs,docs/evidence/m16-network-broker-review.md Original §72 reviewed: real pinned Docker/OpenClaw network=none denies direct Internet/LAN/metadata; only authenticated job-scoped broker calls can reach host-side provider/research/API ports under declared limits and audit. The private unbrokered spike exception was not used.

  `SEC-0060` P0 §72 `VERIFIED` packages/sandbox-adapter/src/docker.ts,apps/worker/src/broker-sidecar.ts,apps/worker/src/broker-router.ts,packages/application/src/completion-broker.ts,packages/application/src/research-broker.ts tests/docker-broker-sidecar-local-integration.mjs,tests/docker-openclaw-exec-local-integration.mjs,tests/m16-installed-worker-e2e.mjs,tests/research-broker.test.mjs,docs/evidence/m16-network-broker-review.md Original §72 reviewed: real pinned Docker/OpenClaw network=none denies direct Internet/LAN/metadata; only authenticated job-scoped broker calls can reach host-side provider/research/API ports under declared limits and audit. The private unbrokered spike exception was not used.

  `SEC-0061` P0 §72 `VERIFIED` packages/sandbox-adapter/src/docker.ts,apps/worker/src/broker-sidecar.ts,apps/worker/src/broker-router.ts,packages/application/src/completion-broker.ts,packages/application/src/research-broker.ts tests/docker-broker-sidecar-local-integration.mjs,tests/docker-openclaw-exec-local-integration.mjs,tests/m16-installed-worker-e2e.mjs,tests/research-broker.test.mjs,docs/evidence/m16-network-broker-review.md Original §72 reviewed: real pinned Docker/OpenClaw network=none denies direct Internet/LAN/metadata; only authenticated job-scoped broker calls can reach host-side provider/research/API ports under declared limits and audit. The private unbrokered spike exception was not used.

  `API-0001`    P1         §73     `DEFERRED_VERIFICATION`   packages/application/src/provider-broker.ts,packages/persistence/src/provider-usage.ts   tests/provider-broker.test.mjs,tests/m06-postgres-integration.mjs   M06 component evidence; backlog:API-0001 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `API-0002`    P1         §73     `DEFERRED_VERIFICATION`   packages/application/src/provider-broker.ts,packages/persistence/src/provider-usage.ts   tests/provider-broker.test.mjs,tests/m06-postgres-integration.mjs   M06 component evidence; backlog:API-0002 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `API-0003`    P1         §73     `DEFERRED_VERIFICATION`   packages/application/src/provider-broker.ts,packages/persistence/src/provider-usage.ts   tests/provider-broker.test.mjs,tests/m06-postgres-integration.mjs   M06 component evidence; backlog:API-0003 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `API-0004`    P1         §73     `DEFERRED_VERIFICATION`   packages/application/src/provider-broker.ts,packages/persistence/src/provider-usage.ts   tests/provider-broker.test.mjs,tests/m06-postgres-integration.mjs   M06 component evidence; backlog:API-0004 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `CAP-0014`    P1         §74     `OPEN_IMPLEMENTATION`   --- --- no executable stage evidence; backlog:CAP-0014 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `CAP-0015`    P1         §74     `OPEN_IMPLEMENTATION`   --- --- no executable stage evidence; backlog:CAP-0015 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `SEC-0062`    P1         §75     `OPEN_IMPLEMENTATION`   packages/policy-engine/src/permission-diff.ts tests/permission-diff.test.mjs baseline only; backlog:SEC-0062

  `PRD-0063`    P1         §76     `VERIFIED`   apps/web/app/capabilities/[slug]/page.tsx,packages/persistence/src/marketplace-buyer.ts   tests/m16-installed-worker-e2e.mjs   Real published manifest, buyer trust/privacy disclosure and paid runtime match; desktop/mobile buyer review. docs/evidence/m16-health-trust-review.md.

  `PRD-0064`    P2         §76     `VERIFIED`   apps/web/app/capabilities/[slug]/page.tsx,packages/persistence/src/marketplace-buyer.ts   tests/m16-installed-worker-e2e.mjs   Buyer detail explains seller execution, network, retention, processors and exact reviewed permissions. docs/evidence/m16-health-trust-review.md.

  `PRD-0065`    P2         §76     `VERIFIED`   apps/web/app/capabilities/[slug]/page.tsx   tests/m16-installed-worker-e2e.mjs   Real buyer detail uses precise trust copy without absolute security claims. docs/evidence/m16-health-trust-review.md.

  `CAP-0016`    P1         §77     `OPEN_IMPLEMENTATION`   packages/policy-engine/src/permission-diff.ts tests/permission-diff.test.mjs baseline only; backlog:CAP-0016

  `CAP-0017`    P1         §77     `OPEN_IMPLEMENTATION`   packages/policy-engine/src/permission-diff.ts tests/permission-diff.test.mjs baseline only; backlog:CAP-0017

  `JOB-0048`    P1         §78     `OPEN_IMPLEMENTATION`   --- --- no executable stage evidence; backlog:JOB-0048 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0049`    P1         §78     `OPEN_IMPLEMENTATION`   --- --- no executable stage evidence; backlog:JOB-0049 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `SEC-0063`    P1         §79     `OPEN_IMPLEMENTATION`   docs/INCIDENT_RESPONSE.md --- runbook only; backlog:SEC-0063 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `SEC-0064`    P0         §79     `OPEN_IMPLEMENTATION`   docs/INCIDENT_RESPONSE.md --- runbook only; backlog:SEC-0064 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `TST-0001`    P1         §80     `DEFERRED_VERIFICATION`   .github/workflows/ci.yml --- workflow not yet run; backlog:TST-0001

  `TST-0002`    P2         §80     `DEFERRED_VERIFICATION`   .github/workflows/ci.yml --- workflow not yet run; backlog:TST-0002

  `TST-0003`    P2         §80     `DEFERRED_VERIFICATION`   .github/workflows/ci.yml --- workflow not yet run; backlog:TST-0003

  `TST-0004`    P2         §80     `DEFERRED_VERIFICATION`   .github/workflows/ci.yml --- workflow not yet run; backlog:TST-0004

  `TST-0005`    P2         §80     `DEFERRED_VERIFICATION`   .github/workflows/ci.yml --- workflow not yet run; backlog:TST-0005

  `PRD-0066`    P1         §81     `DEFERRED_VERIFICATION`   --- --- no executable stage evidence; backlog:PRD-0066

  `PRD-0067`    P2         §81     `DEFERRED_VERIFICATION`   --- --- no executable stage evidence; backlog:PRD-0067

  `OPS-0001`    P1         §82     `DEFERRED_VERIFICATION`   tools/run-local-migrations.mjs tests/sql/m03_visibility.sql local baseline only; backlog:OPS-0001 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `OPS-0002`    P2         §82     `DEFERRED_VERIFICATION`   tools/run-local-migrations.mjs tests/sql/m03_visibility.sql local baseline only; backlog:OPS-0002 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `WRK-0093`    P1         §83     `OPEN_IMPLEMENTATION`   --- --- no executable stage evidence; backlog:WRK-0093 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `WRK-0094`    P1         §83     `OPEN_IMPLEMENTATION`   --- --- no executable stage evidence; backlog:WRK-0094 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `WRK-0095`    P1         §83     `OPEN_IMPLEMENTATION`   --- --- no executable stage evidence; backlog:WRK-0095 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `WRK-0096`    P1         §83     `OPEN_IMPLEMENTATION`   --- --- no executable stage evidence; backlog:WRK-0096 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `OBS-0005`    P1         §84      `VERIFIED`   apps/web/app/health/live/route.ts,apps/web/app/health/ready/route.ts,apps/worker/src/health.ts   tests/m15-health.test.mjs,tests/m15-health-live.test.mjs,tests/m12-local-control.test.mjs   Cloud live/ready endpoints pass fail-closed and real PG/storage/ClamAV checks; Worker uses CLI/private SQLite and opens no LAN management listener.

  `OBS-0006`    P2         §84      `VERIFIED`   apps/web/app/health/live/route.ts,apps/web/app/health/ready/route.ts,apps/worker/src/health.ts   tests/m15-health.test.mjs,tests/m15-health-live.test.mjs,tests/m12-local-control.test.mjs   Cloud live/ready endpoints pass fail-closed and real PG/storage/ClamAV checks; Worker uses CLI/private SQLite and opens no LAN management listener.

  `PRD-0068`    P1    §85    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-planner.ts,packages/domain/src/agent-plan.ts,packages/persistence/src/marketplace-catalog.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/m10-postgres-integration.mjs   M11 closes prior deferred gate with current published supply, deterministic constraints and test evidence; docs/milestones/M11.md.

  `PRD-0069`    P2    §85    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-planner.ts,packages/domain/src/agent-plan.ts,packages/persistence/src/marketplace-catalog.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/m10-postgres-integration.mjs   M11 closes prior deferred gate with current published supply, deterministic constraints and test evidence; docs/milestones/M11.md.

  `PRD-0070`    P1         §86      `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,apps/web/app/capabilities/[slug]/page.tsx,apps/web/app/sellers/[id]/page.tsx   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   Completed paid review eligibility, report problem, separate success/completion/refund/median-runtime/rating projections, later refund and private-supply isolation pass.

  `PRD-0071`    P2         §86      `VERIFIED`   packages/persistence/src/marketplace-social.ts,packages/persistence/migrations/0017_marketplace.sql   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   Settled delivery only; unpaid, duplicate and cross-buyer reviews rejected

  `PRD-0072`    P2         §86      `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/contracts/src/marketplace.ts   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   Seller and capability reliability are distinct authoritative projections; public seller summary excludes private capability jobs.

  `PAY-0074`    P1         §87      `VERIFIED`   packages/persistence/src/seller-economics.ts,packages/persistence/src/seller-operations.ts,packages/persistence/src/finance.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m10-postgres-integration.mjs,tests/m15-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   Dashboard projects UTC jobs, settled gross/fees/net, ledger balances, measured/estimated/unknown provider costs, failure rate and runtime from authoritative records; browser and PostgreSQL checks pass.

  `IO-0035` P1 §88 `DEFERRED_VERIFICATION` packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/job-execution.ts,apps/worker/src/execution-runtime.ts tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-happy-path-trace.md Authenticated seller publication, buyer Web upload/quote, outbound Worker, real Docker/OpenClaw, private browser downloads, verified review/problem report and one development-credit settlement pass; exact 44-step Stripe/Connect, supported Worker install and live discovery sequence remains open. backlog:IO-0035

  `IO-0036` P1 §88 `DEFERRED_VERIFICATION` docs/milestones/M16.md,tools/test-m16-core-worker.sh tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-happy-path-trace.md The 44-step trace includes direct authenticated seller publication, buyer Web upload/quote, result/download and review/report; complete sequence still requires real Stripe/Connect funding and transfer, supported installation and live personal-state discovery. backlog:IO-0036

  `WRK-0097` P1 §89 `VERIFIED` apps/worker/src/execution-supervisor.ts,apps/worker/src/output-upload.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts tests/m16-installed-worker-e2e.mjs,tests/output-upload.test.mjs Real paid development-credit Worker/OpenClaw failure: sanitized error, stopped sandbox, staged-file cleanup, FAILED_EXECUTION cloud transition, idempotent release, zero earning, buyer-safe view and audit. Storage prepare fault also releases without result or Worker crash.

  `WRK-0098`    P1         §89      `VERIFIED`   packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts,apps/worker/src/execution-supervisor.ts   tests/m16-installed-worker-e2e.mjs,tests/m08-finance-postgres-integration.mjs   The installed Worker model-failure path reaches FAILED_EXECUTION, releases the buyer reservation, creates no settlement or seller earning and requires no manual database edit; provider reconciliation also recovers a lost credit-purchase webhook.

  `IO-0037` P1 §90 `VERIFIED` tests/fixtures/m16-document-analyzer/,tests/m16-installed-worker-e2e.mjs,tests/m16-core-worker-integration.mjs,tests/m06-postgres-integration.mjs docs/evidence/m16-boundaries.json,docs/evidence/m16-canonical-fixtures.md Canonical TXT Document Analyzer runs real pinned Docker/OpenClaw with a reviewed skill, private buyer file, two generated private outputs and one development-credit ledger settlement; the separate synthetic private-database fixture exercises the real read-only Worker broker. §92 Stripe staging remains open independently.

  `TST-0006` P1 §91 `DEFERRED_VERIFICATION` tools/m16-verification-audit.mjs,docs/evidence/m16-security-checklist.md docs/evidence/m16-attack-matrix.md,docs/evidence/m16-boundaries.json,tests/m16-verification-audit.test.mjs Local checklist and public fail-closed gate pass; quiesced personal-state attribution and external assessment or explicit private-beta risk acceptance remain required. backlog:TST-0006

  `TST-0007` P2 §91 `VERIFIED` packages/persistence/src/seller-profiles.ts,packages/persistence/migrations/0030_private_alpha_seller_invites.sql,tools/kivro-seller-invite.mjs,tools/m16-verification-audit.mjs tests/m16-seller-onboarding-postgres-integration.mjs,tests/m16-verification-audit.test.mjs Production seller creation requires a one-time DB-admin-issued invitation while the public security gate is open; release gate refuses public opening. Expiry, revocation, concurrent creation, owner scope and audit pass.

  `TST-0008` P1 §92 `DEFERRED_VERIFICATION` tools/m16-verification-audit.mjs,tools/test-m16-core-worker.sh tests/m16-verification-audit.test.mjs,tests/m16-installed-worker-e2e.mjs Release gate correctly rejects development-credit evidence as final acceptance; real authenticated seller/buyer Web and installed Worker execution pass, while supported Worker installation and real Stripe/provider test purchase remain. backlog:TST-0008

  `TST-0009` P2 §92 `DEFERRED_VERIFICATION` tests/m16-installed-worker-e2e.mjs,tools/test-m16-stripe-runner.mjs tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-boundaries.json Distinct buyer/seller identities, installed Worker and one ledger settlement pass with development credits; exact real Stripe-funded run requires unavailable Stripe test credentials and ready Connect account. backlog:TST-0009

  `TST-0010` P2 §92 `VERIFIED` runtime/openclaw,apps/worker/src/execution-runtime.ts tests/m16-installed-worker-e2e.mjs,tests/docker-openclaw-exec-local-integration.mjs,docs/evidence/m16-boundaries.json The installed paid Worker runs the actual pinned OpenClaw inside Docker, performs real tool calls, creates files and returns results; the model service is deterministic but OpenClaw is not mocked. The separate final Stripe/provider staging gate remains open.

  `TST-0011` P2 §92 `DEFERRED_VERIFICATION` packages/infrastructure/stripe/src/gateway.ts,tools/test-m16-stripe-runner.mjs tests/m08-finance-postgres-integration.mjs,tests/m16-e2e-preflight.test.mjs Stripe gateway/reconciliation and the test-mode harness exist; actual PaymentIntent/Connect acceptance requires unavailable Stripe test credentials and a ready Connect account. backlog:TST-0011

  `TST-0012` P2 §92 `DEFERRED_VERIFICATION` tools/test-m16-core-worker.sh,tools/test-m16-stripe-runner.mjs,packages/infrastructure/stripe/src/gateway.ts tests/m16-installed-worker-e2e.mjs,tests/m16-e2e-preflight.test.mjs Real local OpenClaw, authenticated seller/buyer browser, outbound Worker and private storage pass; the same harness has a fail-closed Stripe test mode. Actual provider payment sandbox execution requires unavailable Stripe test credentials and a ready test Connect account; no provider-backed result is claimed. backlog:TST-0012

  `IO-0038`     P1         §93      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:IO-0038

  `IO-0039`     P1         §93      `VERIFIED` packages/contracts/src,packages/openclaw-adapter/src/read-only-discovery.ts,docs/openclaw-interfaces.md tests/openclaw-discovery.test.mjs,tests/worker-cli.test.mjs,git:46084a5 The M01/M02 commit contains the repository skeleton, shared contracts, discovery tests and interface notes before marketplace pages existed; current discovery remains read-only and reports uncertainty.

  `IO-0040`     P1         §93      `VERIFIED`   packages/openclaw-adapter/src/job-config.ts,apps/worker/src/execution-supervisor.ts,packages/sandbox-adapter/src/docker.ts,runtime/openclaw/runner.mjs   tests/docker-openclaw-exec-local-integration.mjs,tests/docker-openclaw-image-local-integration.mjs,tests/openclaw-job-config.test.mjs   Real pinned OpenClaw job; same-container host-file/private-network denial and required sandbox preflight pass

  `IO-0041`     P1         §93      `TESTED`   docs/milestones/M00.md,docs/milestones/M16.md   docs/evidence/m16-requirement-triage.md   Dated M00–M16 records document tests/status but do not contemporaneously prove an explicit deviations and unresolved-security list at every prior milestone; the historical procedure cannot be recreated after the fact.

  `TST-0013`    P1         §94      `VERIFIED` tsconfig.json,package.json,apps/worker/src/cli.ts,tools/kivro-worker-sync.mjs,tools/kivro-scheduler.mjs docs/evidence/m16-boundaries.json,docs/evidence/m16-code-quality.md,tests/m16-code-quality.test.mjs Strict TypeScript, bounded structured errors/logs, trust-boundary, database/financial/security tests, lockfile, documented environment and tracked/new secret-shape scan passed together in the 31-step M16 matrix; separate release/security gates remain open.

  `TST-0014`    P2         §94      `USER_OVERRIDE`   .env.example   tests/env.test.mjs   User explicitly requested illustrative values and comments for every example variable; placeholders are marked non-credentials. Original names-only criterion is superseded, not VERIFIED.

  `TST-0015`    P2         §94     `VERIFIED`   packages/persistence/src/finance.ts,apps/worker/src/job-admission.ts,apps/worker/src/broker-router.ts,apps/worker/src/selected-local-file.ts,packages/sandbox-adapter/src/docker.ts,packages/worker-protocol/src/messages.ts   docs/evidence/m16-security-explicitness-review.md,tests/m08-finance-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,tests/docker-sandbox-local-integration.mjs   Adversarial source review found explicit financial, admission, broker and sandbox decisions, strict schemas, named errors and no unexplained TypeScript any; independent §91 review remains separate.

  `PRD-0073`    P1         §95      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0073

  `PRD-0074`    P1         §96     `OPEN_IMPLEMENTATION`   packages/domain/src/dependency-graph.ts,apps/worker/src/import-drafts.ts   tests/dependency-graph.test.mjs,tests/import-drafts.test.mjs   Seller-local suggestions start unselected and require explicit action; authenticated wizard/publication enforcement pending baseline/open; backlog:PRD-0074

  `PRD-0075`    P2         §96     `OPEN_IMPLEMENTATION`   packages/domain/src/dependency-graph.ts,apps/worker/src/import-drafts.ts   tests/dependency-graph.test.mjs,tests/import-drafts.test.mjs   Seller-local suggestions start unselected and require explicit action; authenticated wizard/publication enforcement pending baseline/open; backlog:PRD-0075

  `PRD-0076`    P2         §96     `OPEN_IMPLEMENTATION`   packages/domain/src/dependency-graph.ts,apps/worker/src/import-drafts.ts   tests/dependency-graph.test.mjs,tests/import-drafts.test.mjs   Seller-local suggestions start unselected and require explicit action; authenticated wizard/publication enforcement pending baseline/open; backlog:PRD-0076

  `PRD-0077`    P2         §96     `OPEN_IMPLEMENTATION`   packages/domain/src/dependency-graph.ts,apps/worker/src/import-drafts.ts   tests/dependency-graph.test.mjs,tests/import-drafts.test.mjs   Seller-local suggestions start unselected and require explicit action; authenticated wizard/publication enforcement pending baseline/open; backlog:PRD-0077

  `PRD-0078`    P2         §96     `OPEN_IMPLEMENTATION`   packages/domain/src/dependency-graph.ts,apps/worker/src/import-drafts.ts   tests/dependency-graph.test.mjs,tests/import-drafts.test.mjs   Seller-local suggestions start unselected and require explicit action; authenticated wizard/publication enforcement pending baseline/open; backlog:PRD-0078

  `PRD-0079`    P2         §96     `OPEN_IMPLEMENTATION`   packages/domain/src/dependency-graph.ts,apps/worker/src/import-drafts.ts   tests/dependency-graph.test.mjs,tests/import-drafts.test.mjs   Seller-local suggestions start unselected and require explicit action; authenticated wizard/publication enforcement pending baseline/open; backlog:PRD-0079

  `AGT-0001`    P1         §97     `OPEN_IMPLEMENTATION`   apps/web/app/seller/page.tsx   tests/browser/auth-email.spec.ts   Seller entry explains local execution, seller costs, draft status and explicit selection; full wizard/runtime proof pending baseline/open; backlog:AGT-0001 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `AGT-0002`    P1         §97     `OPEN_IMPLEMENTATION`   apps/web/app/seller/page.tsx   tests/browser/auth-email.spec.ts   Seller entry explains local execution; complete first-publication journey pending baseline/open; backlog:AGT-0002 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `AGT-0003`    P1         §97     `OPEN_IMPLEMENTATION`   apps/web/app/seller/page.tsx   tests/browser/auth-email.spec.ts   Seller entry states only explicitly approved resources; actual permission enforcement pending baseline/open; backlog:AGT-0003 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `AGT-0004`    P1         §97     `OPEN_IMPLEMENTATION`   apps/web/app/seller/page.tsx   tests/browser/auth-email.spec.ts   Seller entry states model/provider usage is the seller's operating cost; economics and guardrails pending baseline/open; backlog:AGT-0004 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `AGT-0005`    P1         §98     `OPEN_IMPLEMENTATION`   packages/contracts/src/dependency-graph.ts   tests/dependency-graph.test.mjs   §98 Inference dependency schema and mandatory-inference graph blocker; health/publishing flow pending baseline/open; backlog:AGT-0005

  `AGT-0006`    P1         §98     `OPEN_IMPLEMENTATION`   packages/contracts/src/dependency-graph.ts   tests/dependency-graph.test.mjs   §98 Inference dependency schema and mandatory-inference graph blocker; health/publishing flow pending baseline/open; backlog:AGT-0006

  `AGT-0007`    P1         §98     `OPEN_IMPLEMENTATION`   packages/contracts/src/dependency-graph.ts   tests/dependency-graph.test.mjs   §98 Inference dependency schema and mandatory-inference graph blocker; health/publishing flow pending baseline/open; backlog:AGT-0007

  `AGT-0008`    P1         §98     `OPEN_IMPLEMENTATION`   packages/contracts/src/dependency-graph.ts   tests/dependency-graph.test.mjs   §98 Inference dependency schema and mandatory-inference graph blocker; health/publishing flow pending baseline/open; backlog:AGT-0008

  `AGT-0009`    P1         §99     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:AGT-0009 M06 component review:docs/milestones/M06.md

  `AGT-0010`    P1         §99     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:AGT-0010 M06 component review:docs/milestones/M06.md

  `AGT-0011`    P1         §99     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:AGT-0011 M06 component review:docs/milestones/M06.md

  `AGT-0012`    P1         §99     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:AGT-0012 M06 component review:docs/milestones/M06.md

  `AGT-0013`    P1         §99     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:AGT-0013 M06 component review:docs/milestones/M06.md

  `AGT-0014`    P1         §99     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:AGT-0014 M06 component review:docs/milestones/M06.md

  `AGT-0015`    P1         §100     `DEFERRED_VERIFICATION`   `packages/openclaw-adapter/src/{read-only-discovery,job-config}.ts`; `apps/worker/src/{guided-import,import-review-command,runtime-readiness,execution-runtime}.ts`   `tests/{openclaw-discovery,openclaw-job-config,local-inference-runtime,guided-import}.test.mjs`; `tests/docker-local-inference-local-integration.mjs`   Local model production config, broker and isolated Docker components pass; exact published paid-job acceptance remains open; backlog:AGT-0015

  `AGT-0016`    P1         §100     `DEFERRED_VERIFICATION`   `packages/openclaw-adapter/src/read-only-discovery.ts`   `tests/openclaw-discovery.test.mjs`; `tests/guided-import.test.mjs`   Read-only configured local provider/model discovery passes; installed seller-to-publication acceptance remains open; backlog:AGT-0016

  `AGT-0017`    P1         §100     `VERIFIED`   packages/openclaw-adapter/src/read-only-discovery.ts,packages/openclaw-adapter/src/local-inference-health.ts   tests/openclaw-discovery.test.mjs,tests/local-inference-runtime.test.mjs   Read-only configured metadata yields provider, model, endpoint, required service and explicit unknown availability/hardware; bounded exact-model health adds observed readiness/latency without inventing hardware estimates.

  `AGT-0018`    P1         §100     `VERIFIED`   packages/openclaw-adapter/src/read-only-discovery.ts,apps/worker/src/runtime-readiness.ts   tests/openclaw-discovery.test.mjs,tests/m16-installed-worker-e2e.mjs   The declared local model service is checked by exact model ID; the installed Worker observes a live health failure as NOT_READY and recovers only after the service responds again.

  `AGT-0019`    P1         §100     `VERIFIED`   apps/worker/src/runtime-readiness.ts,apps/worker/src/dispatch-loop.ts   tests/local-inference-runtime.test.mjs,tests/m16-installed-worker-e2e.mjs   In the installed paid Worker path a failed local-model health endpoint removes readiness; a funded second job is rejected or remains unoffered with zero execution until health returns, after which READY recovers.

  `AGT-0020`    P1         §101     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:AGT-0020 M08 component evidence: packages/persistence/src/finance.ts,tests/m08-finance-postgres-integration.mjs; backlog:AGT-0020

  `AGT-0021`    P1         §101     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:AGT-0021 M08 component evidence: packages/persistence/src/finance.ts,tests/m08-finance-postgres-integration.mjs; backlog:AGT-0021

  `AGT-0022`    P1         §101     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:AGT-0022 M08 component evidence: packages/persistence/src/finance.ts,tests/m08-finance-postgres-integration.mjs; backlog:AGT-0022

  `CAP-0018`    P1         §102     `OPEN_IMPLEMENTATION`   packages/contracts/src/dependency-graph.ts,packages/domain/src/dependency-graph.ts   tests/dependency-graph.test.mjs   §102–103 Strict graph nodes/edges and explicit selection; persistence/runtime graph pending baseline/open; backlog:CAP-0018

  `CAP-0019`    P1         §102     `OPEN_IMPLEMENTATION`   packages/contracts/src/dependency-graph.ts,packages/domain/src/dependency-graph.ts   tests/dependency-graph.test.mjs   §102–103 Strict graph nodes/edges and explicit selection; persistence/runtime graph pending baseline/open; backlog:CAP-0019

  `CAP-0020`    P1         §102     `OPEN_IMPLEMENTATION`   packages/contracts/src/dependency-graph.ts,packages/domain/src/dependency-graph.ts   tests/dependency-graph.test.mjs   §102–103 Strict graph nodes/edges and explicit selection; persistence/runtime graph pending baseline/open; backlog:CAP-0020

  `CAP-0021`    P1         §103     `OPEN_IMPLEMENTATION`   packages/contracts/src/dependency-graph.ts,packages/domain/src/dependency-graph.ts   tests/dependency-graph.test.mjs   §102–103 Strict graph nodes/edges and explicit selection; persistence/runtime graph pending baseline/open; backlog:CAP-0021 M06 component review:docs/milestones/M06.md

  `AGT-0023`    P1         §104     `OPEN_IMPLEMENTATION`   packages/openclaw-adapter/src/dependency-candidates.ts,packages/openclaw-adapter/src/read-only-discovery.ts   tests/openclaw-discovery.test.mjs   §104 Static declared skill dependencies become unselected candidates; runtime observation pending baseline/open; backlog:AGT-0023 M06 component review:docs/milestones/M06.md

  `AGT-0024`    P1         §104     `OPEN_IMPLEMENTATION`   packages/openclaw-adapter/src/dependency-candidates.ts,packages/openclaw-adapter/src/read-only-discovery.ts   tests/openclaw-discovery.test.mjs   §104 Static declared skill dependencies become unselected candidates; runtime observation pending baseline/open; backlog:AGT-0024 M06 component review:docs/milestones/M06.md

  `AGT-0025`    P1         §104     `OPEN_IMPLEMENTATION`   packages/openclaw-adapter/src/dependency-candidates.ts,packages/openclaw-adapter/src/read-only-discovery.ts   tests/openclaw-discovery.test.mjs   §104 Static declared skill dependencies become unselected candidates; runtime observation pending baseline/open; backlog:AGT-0025 M06 component review:docs/milestones/M06.md

  `AGT-0026`    P1         §104     `OPEN_IMPLEMENTATION`   packages/openclaw-adapter/src/dependency-candidates.ts,packages/openclaw-adapter/src/read-only-discovery.ts   tests/openclaw-discovery.test.mjs   §104 Static declared skill dependencies become unselected candidates; runtime observation pending baseline/open; backlog:AGT-0026 M06 component review:docs/milestones/M06.md

  `AGT-0027`    P1         §104     `OPEN_IMPLEMENTATION`   packages/openclaw-adapter/src/dependency-candidates.ts,packages/openclaw-adapter/src/read-only-discovery.ts   tests/openclaw-discovery.test.mjs   §104 Static declared skill dependencies become unselected candidates; runtime observation pending baseline/open; backlog:AGT-0027 M06 component review:docs/milestones/M06.md

  `CAP-0022`    P1         §105     `OPEN_IMPLEMENTATION`   packages/contracts/src/dependency-graph.ts,packages/domain/src/dependency-graph.ts   tests/dependency-graph.test.mjs   §105 Confidence/unknown health represented; seller UI and runtime confirmation pending baseline/open; backlog:CAP-0022

  `CAP-0023`    P1         §105     `OPEN_IMPLEMENTATION`   packages/contracts/src/dependency-graph.ts,packages/domain/src/dependency-graph.ts   tests/dependency-graph.test.mjs   §105 Confidence/unknown health represented; seller UI and runtime confirmation pending baseline/open; backlog:CAP-0023

  `CAP-0024`    P1         §105     `OPEN_IMPLEMENTATION`   packages/contracts/src/dependency-graph.ts,packages/domain/src/dependency-graph.ts   tests/dependency-graph.test.mjs   §105 Confidence/unknown health represented; seller UI and runtime confirmation pending baseline/open; backlog:CAP-0024

  `CAP-0025`    P1         §105     `OPEN_IMPLEMENTATION`   packages/contracts/src/dependency-graph.ts,packages/domain/src/dependency-graph.ts   tests/dependency-graph.test.mjs   §105 Confidence/unknown health represented; seller UI and runtime confirmation pending baseline/open; backlog:CAP-0025

  `UI-0001`    P1         §106     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:UI-0001

  `UI-0002`    P2         §106     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:UI-0002

  `UI-0003`    P2         §106     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:UI-0003

  `UI-0004`    P2         §106     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:UI-0004

  `UI-0005`    P2         §106     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:UI-0005

  `UI-0006`    P2         §106     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:UI-0006

  `UI-0007`    P2         §106     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:UI-0007

  `UI-0008`    P1         §107     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:UI-0008 M06 component review:docs/milestones/M06.md

  `UI-0009`    P2         §107     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:UI-0009 M06 component review:docs/milestones/M06.md

  `UI-0010`    P2         §107     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:UI-0010 M06 component review:docs/milestones/M06.md

  `UI-0011`    P2         §107     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:UI-0011 M06 component review:docs/milestones/M06.md

  `UI-0012`    P2         §107     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:UI-0012 M06 component review:docs/milestones/M06.md

  `UI-0013`    P2         §107     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:UI-0013 M06 component review:docs/milestones/M06.md

  `UI-0014`    P2         §107     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:UI-0014 M06 component review:docs/milestones/M06.md

  `UI-0015`    P2         §107     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:UI-0015 M06 component review:docs/milestones/M06.md

  `CAP-0026`    P1         §108     `OPEN_IMPLEMENTATION`   packages/domain/src/dependency-graph.ts,packages/contracts/src/dependency-graph.ts   tests/dependency-graph.test.mjs   §108 Unsupported/cyclic/alternative dependencies block static readiness; conflict UI/runtime proof pending baseline/open; backlog:CAP-0026

  `CAP-0027`    P1         §108     `OPEN_IMPLEMENTATION`   packages/domain/src/dependency-graph.ts,packages/contracts/src/dependency-graph.ts   tests/dependency-graph.test.mjs   §108 Unsupported/cyclic/alternative dependencies block static readiness; conflict UI/runtime proof pending baseline/open; backlog:CAP-0027

  `CAP-0028`    P1         §108     `OPEN_IMPLEMENTATION`   packages/domain/src/dependency-graph.ts,packages/contracts/src/dependency-graph.ts   tests/dependency-graph.test.mjs   §108 Unsupported/cyclic/alternative dependencies block static readiness; conflict UI/runtime proof pending baseline/open; backlog:CAP-0028

  `CAP-0029`    P1         §108     `OPEN_IMPLEMENTATION`   packages/domain/src/dependency-graph.ts,packages/contracts/src/dependency-graph.ts   tests/dependency-graph.test.mjs   §108 Unsupported/cyclic/alternative dependencies block static readiness; conflict UI/runtime proof pending baseline/open; backlog:CAP-0029

  `CAP-0030`    P1         §108     `OPEN_IMPLEMENTATION`   packages/domain/src/dependency-graph.ts,packages/contracts/src/dependency-graph.ts   tests/dependency-graph.test.mjs   §108 Unsupported/cyclic/alternative dependencies block static readiness; conflict UI/runtime proof pending baseline/open; backlog:CAP-0030

  `CAP-0031`    P1         §108     `OPEN_IMPLEMENTATION`   packages/domain/src/dependency-graph.ts,packages/contracts/src/dependency-graph.ts   tests/dependency-graph.test.mjs   §108 Unsupported/cyclic/alternative dependencies block static readiness; conflict UI/runtime proof pending baseline/open; backlog:CAP-0031

  `CAP-0032`    P1         §108     `OPEN_IMPLEMENTATION`   packages/domain/src/dependency-graph.ts,packages/contracts/src/dependency-graph.ts   tests/dependency-graph.test.mjs   §108 Unsupported/cyclic/alternative dependencies block static readiness; conflict UI/runtime proof pending baseline/open; backlog:CAP-0032

  `AGT-0028`    P1         §109     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:AGT-0028 M06 component review:docs/milestones/M06.md

  `AGT-0029`    P1         §109     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:AGT-0029 M06 component review:docs/milestones/M06.md

  `AGT-0030`    P1         §109     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:AGT-0030 M06 component review:docs/milestones/M06.md

  `AGT-0031`    P1         §109     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:AGT-0031 M06 component review:docs/milestones/M06.md

  `AGT-0032`    P1         §109     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:AGT-0032 M06 component review:docs/milestones/M06.md

  `CAP-0033`    P1         §110     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-package.ts,packages/domain/src/capability-version.ts   tests/capability-version.test.mjs   Full graph in strict local package and canonical graph/package hashes in cloud candidate; persistence and publication pending baseline/open; backlog:CAP-0033

  `CAP-0034`    P1         §110     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-package.ts,packages/domain/src/capability-version.ts   tests/capability-version.test.mjs   Full graph in strict local package and canonical graph/package hashes in cloud candidate; immutable stored version proof pending baseline/open; backlog:CAP-0034

  `CAP-0035`    P1         §110     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:CAP-0035

  `CAP-0036`    P1         §110     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:CAP-0036

  `CAP-0037`    P1         §111     `OPEN_IMPLEMENTATION`   apps/web/app/seller/page.tsx,packages/persistence/migrations/0009_seller_execution_ack.sql   tests/browser/auth-email.spec.ts,tests/sql/m03_visibility.sql   Step 1 seller execution model requires an explicit durable acknowledgement; later wizard steps pending baseline/open; backlog:CAP-0037 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `CAP-0038`    P1         §111     `OPEN_IMPLEMENTATION`   apps/web/app/seller/page.tsx   tests/browser/auth-email.spec.ts   First-publication entry and ordered steps exist; Worker pairing/discovery/review/publish pending baseline/open; backlog:CAP-0038 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `CAP-0039`    P1         §111     `OPEN_IMPLEMENTATION`   apps/web/app/seller/seller-profile-form.tsx,packages/persistence/src/seller-profiles.ts,packages/persistence/migrations/0009_seller_execution_ack.sql   tests/browser/auth-email.spec.ts,tests/seller-profile-local-integration.mjs,tests/sql/m03_visibility.sql   Unchecked by default, authenticated explicit acknowledgement persisted append-only; complete wizard confirmation matrix pending baseline/open; backlog:CAP-0039 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `CAP-0040`    P1         §111     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:CAP-0040 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `CAP-0041`    P1         §111     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:CAP-0041 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `CAP-0042`    P1         §111     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:CAP-0042 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `CAP-0043`    P1         §112     `OPEN_IMPLEMENTATION`   packages/contracts/src/dependency-graph.ts,packages/domain/src/dependency-graph.ts,apps/worker/src/import-drafts.ts   tests/dependency-graph.test.mjs,tests/import-drafts.test.mjs   §112 Consent records bind seller/Worker/version/dependency/manifest hash in private append-only local SQLite; authenticated publication enforcement pending baseline/open; backlog:CAP-0043

  `CAP-0044`    P1         §113     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:CAP-0044

  `CAP-0045`    P1         §113     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:CAP-0045

  `CAP-0046`    P1         §113     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:CAP-0046

  `CAP-0047`    P1         §114     `OPEN_IMPLEMENTATION`   apps/worker/src/import-package.ts,apps/worker/src/capability-package-store.ts,packages/contracts/src/capability-package.ts   tests/import-package.test.mjs,tests/worker-cli.test.mjs,tests/worker-package-store.test.mjs   A narrow selected-skill plus remote-inference package is staged privately with exact immutable bytes; full resource graph, real isolated tests, signed review and published/effective-sandbox consistency remain open; backlog:CAP-0047

  `CAP-0048`    P1         §114     `OPEN_IMPLEMENTATION`   apps/worker/src/import-package.ts,packages/contracts/src/capability-package.ts   tests/import-package.test.mjs,tests/worker-cli.test.mjs   The authored package contains a credential reference rather than a credential value; selected skill bytes are stored separately in private Worker SQLite. Artifact-wide secret scanning and representative runtime proof remain required; backlog:CAP-0048

  `SEC-0065`    P1         §115     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:SEC-0065 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0050`    P1         §116     `VERIFIED`   apps/worker/src/runtime-readiness.ts,apps/worker/src/job-admission.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/availability.ts   tests/worker-admission.test.mjs,tests/worker-runtime-readiness.test.mjs,tests/worker-resource-ports.test.mjs,tests/docker-sandbox-resources-local-integration.mjs,tests/m09-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-dependency-dispatch-closure.md   M16 each immutable version/readiness prerequisite fails paid offer before acceptance; Core requeues an unaccepted offer or releases reservation once under cancellation.

  `JOB-0051`    P1         §116     `VERIFIED`   apps/worker/src/runtime-readiness.ts,apps/worker/src/resource-ports.ts,apps/worker/src/job-admission.ts,apps/worker/src/seller-credential-vault.ts   tests/worker-resource-ports.test.mjs,tests/worker-runtime-readiness.test.mjs,tests/worker-admission.test.mjs,docs/evidence/m16-dependency-admission.md   Every seller-declared credential reference is checked through the device-scoped vault; missing secrets make readiness false and block admission even when payment is secured.

  `JOB-0052`    P1         §116     `VERIFIED`   apps/worker/src/runtime-readiness.ts,apps/worker/src/job-admission.ts,apps/worker/src/availability-reporter.ts   tests/docker-local-inference-local-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-dependency-admission.md   A stopped real seller local model changes signed readiness and prevents a new paid Worker execution until service recovery.

  `JOB-0053`    P1         §116     `VERIFIED`   apps/worker/src/runtime-readiness.ts,apps/worker/src/resource-ports.ts,apps/worker/src/job-admission.ts   tests/selected-local-file.test.mjs,tests/docker-selected-file-broker-local-integration.mjs,tests/docker-openclaw-selected-file-local-integration.mjs,tests/m06-postgres-integration.mjs,tests/docker-sandbox-resources-local-integration.mjs,docs/evidence/m16-dependency-admission.md   Real selected-file binding and database/API resource probes are required for readiness; changed seller file fails before paid offer admission, and Docker only sees brokered resources.

  `JOB-0054`    P1         §116     `VERIFIED`   apps/worker/src/runtime-readiness.ts,apps/worker/src/job-admission.ts,apps/worker/src/availability-reporter.ts   tests/worker-runtime-readiness.test.mjs,tests/worker-admission.test.mjs,tests/availability-reporter.test.mjs,docs/evidence/m16-dependency-admission.md   Per-offer readiness checks reviewed hashes, image, vault, local model and resource health without rerunning the isolated representative review; signed heartbeat preserves current per-version readiness.

  `JOB-0055`    P1         §116     `VERIFIED`   apps/worker/src/dispatch-loop.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/availability.ts,packages/persistence/src/finance.ts   tests/worker-dispatch-loop.test.mjs,tests/m09-postgres-integration.mjs,docs/evidence/m16-dependency-admission.md   Replayed unready paid offers are refused before Worker acceptance without crashing the loop; expired never-accepted offers requeue durably across repository restart and eligible buyer cancellation releases exactly one reservation.

  `AGT-0033`    P1         §117     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:AGT-0033 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `AGT-0034`    P1         §117     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:AGT-0034 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `CAP-0049`    P1         §118     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:CAP-0049 M06 component review:docs/milestones/M06.md M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `CAP-0050`    P1         §118     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:CAP-0050 M06 component review:docs/milestones/M06.md M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `CAP-0051`    P1         §118     `OPEN_IMPLEMENTATION`   ---              ---        --- baseline/open; backlog:CAP-0051 M06 component review:docs/milestones/M06.md M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `PRD-0080`    P1         §119     `VERIFIED`   apps/web/app/capabilities/[slug]/page.tsx,packages/contracts/src/capability-package.ts,packages/persistence/src/seller-publication.ts,apps/worker/src/execution-runtime.ts   tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-capability-principle.md   M16 current-tree paid Docker/OpenClaw published-version E2E passed 2/2; original §119/§259 review: docs/evidence/m16-capability-principle.md.

  `PRD-0081`    P2         §119     `VERIFIED`   apps/web/app/capabilities/[slug]/page.tsx   tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-capability-principle.md   M16 current-tree paid Docker/OpenClaw published-version E2E passed 2/2; original §119/§259 review: docs/evidence/m16-capability-principle.md.

  `PRD-0082`    P2         §119     `VERIFIED`   packages/contracts/src/capability-package.ts,packages/persistence/src/seller-publication.ts,apps/worker/src/execution-runtime.ts   tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-capability-principle.md   M16 current-tree paid Docker/OpenClaw published-version E2E passed 2/2; original §119/§259 review: docs/evidence/m16-capability-principle.md.

  `PRD-0083`    P1         §120      `TODO`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   OPEN later-owned implementation: M14 combined buyer/seller activation under one login; M10 public catalog primitive available where applicable

  `PRD-0084`    P2         §120      `TODO`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   OPEN later-owned implementation: M14 combined buyer/seller account journey; M10 public catalog primitive available where applicable

  `PRD-0085`    P2         §120     `VERIFIED`   apps/web/app/capabilities/[slug]/run-form.tsx,apps/web/app/buyer/jobs/[id]/page.tsx,packages/persistence/src/marketplace-buyer.ts   tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-buyer-file-input-review.md   M16 original-source review and current-tree 32/32 boundary matrix; no Stripe or deployed-provider acceptance claimed.

  `PRD-0086`    P2         §120      `TODO`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   OPEN later-owned implementation: M14 seller prerequisites and publishing UI; M10 public catalog primitive available where applicable

  `PRD-0087`    P2         §120      `TODO`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   OPEN later-owned implementation: M14 seller workspace sections; M11 AI Request now passes browser evidence; M10 public catalog primitive available where applicable

  `PRD-0088`    P1         §121      `TODO`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   OPEN later-owned implementation: M14 seller earnings journey under the buyer login; M10 public catalog primitive available where applicable

  `PRD-0089`    P2         §121      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `PRD-0090`    P1         §122      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `PRD-0091`    P2         §122      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `PRD-0092`    P1         §123      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `PRD-0093`    P2         §123      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `PRD-0094`    P2         §123      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `PRD-0095`    P1    §124    `VERIFIED`   apps/web/app/capabilities/[slug]/page.tsx,apps/web/app/ai-request/page.tsx   tests/browser-m10/marketplace.spec.ts   M11 capability-detail Agent link and buyer entry verified in browser.

  `PRD-0096`    P2         §124      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `PRD-0097`    P1         §125      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `PRD-0098`    P2         §125      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `CAP-0052`    P1         §126      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `JOB-0056`    P1         §127      `VERIFIED`   packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,apps/web/app/buyer/jobs/[id]/page.tsx,apps/web/app/buyer/jobs/[id]/job-actions.tsx,apps/web/app/buyer/page.tsx,apps/web/app/capabilities/[slug]/page.tsx   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-buyer-history-review.md   Real installed paid Worker success/failure/cancellation persist across a fresh buyer browser; completed files, review/report, favorite, safe failed status/released credits and current-term Run Again pass. The distinct Stripe staging gate stays open.

  `JOB-0057`    P1         §127      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `JOB-0058`    P1         §127      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `JOB-0059`    P1         §127      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `PRD-0099`    P1         §128      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `PRD-0100`    P2         §128      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `PRD-0101`    P1    §129    `VERIFIED`   packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-discovery.ts,packages/persistence/src/marketplace-catalog.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0102`    P2    §129    `VERIFIED`   packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-discovery.ts,packages/persistence/src/marketplace-catalog.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0103`    P1    §130    `VERIFIED`   packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-discovery.ts,packages/persistence/src/marketplace-catalog.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0104`    P2    §130    `VERIFIED`   packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-discovery.ts,packages/persistence/src/marketplace-catalog.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0105`    P1    §131    `VERIFIED`   packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-discovery.ts,packages/persistence/src/marketplace-catalog.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0106`    P2    §131    `VERIFIED`   packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-discovery.ts,packages/persistence/src/marketplace-catalog.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0107`    P2    §131    `VERIFIED`   packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-discovery.ts,packages/persistence/src/marketplace-catalog.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0108`    P2    §131    `VERIFIED`   packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-discovery.ts,packages/persistence/src/marketplace-catalog.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0109`    P2    §131    `VERIFIED`   packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-discovery.ts,packages/persistence/src/marketplace-catalog.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0110`    P1    §132    `VERIFIED`   packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-discovery.ts,packages/persistence/src/marketplace-catalog.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0111`    P2    §132    `VERIFIED`   packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-discovery.ts,packages/persistence/src/marketplace-catalog.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0112`    P1    §133    `VERIFIED`   packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-discovery.ts,packages/persistence/src/marketplace-catalog.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0113`    P2    §133    `VERIFIED`   packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-discovery.ts,packages/persistence/src/marketplace-catalog.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0114`    P2    §133    `VERIFIED`   packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-discovery.ts,packages/persistence/src/marketplace-catalog.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0115`    P2    §133    `VERIFIED`   packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-discovery.ts,packages/persistence/src/marketplace-catalog.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0116`    P1    §134    `VERIFIED`   packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-discovery.ts,packages/persistence/src/marketplace-catalog.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0035`    P1    §135    `VERIFIED`   packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-discovery.ts,packages/persistence/src/marketplace-catalog.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0036`    P1    §135    `VERIFIED`   packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-discovery.ts,packages/persistence/src/marketplace-catalog.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0037`    P1    §135    `VERIFIED`   packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-discovery.ts,packages/persistence/src/marketplace-catalog.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0117`    P1    §136    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0118`    P2    §136    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0038`    P1    §137    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0039`    P1    §137    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0119`    P1    §138    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0120`    P2    §138    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0121`    P2    §138    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `IO-0042`    P1    §139    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `IO-0043`    P1    §139    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `IO-0044`    P1    §139    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `JOB-0060`    P1    §140    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `JOB-0061`    P1    §140    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `JOB-0062`    P1    §140    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `JOB-0063`    P1    §140    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `JOB-0064`    P1    §141    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `JOB-0065`    P1    §141    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PAY-0075`    P1    §142    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PAY-0076`    P0    §142    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PAY-0077`    P0    §142    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0040`    P1    §143    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0041`    P1    §143    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0042`    P1    §143    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0043`    P1    §143    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0044`    P1    §143    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0122`    P1    §144    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0123`    P2    §144    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0124`    P2    §144    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0125`    P2    §144    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0045`    P1    §145    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0046`    P1    §145    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/marketplace-agent.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0126`    P1    §146    `VERIFIED`   packages/application/src/marketplace-agent-tools.ts,packages/application/src/platform-inference-router.ts,packages/application/src/agent-purchase-authorization.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0127`    P2    §146    `VERIFIED`   packages/application/src/marketplace-agent-tools.ts,packages/application/src/platform-inference-router.ts,packages/application/src/agent-purchase-authorization.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0128`    P2    §146    `VERIFIED`   packages/application/src/marketplace-agent-tools.ts,packages/application/src/platform-inference-router.ts,packages/application/src/agent-purchase-authorization.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0129`    P2    §146    `VERIFIED`   packages/application/src/marketplace-agent-tools.ts,packages/application/src/platform-inference-router.ts,packages/application/src/agent-purchase-authorization.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0130`    P1    §147    `VERIFIED`   packages/application/src/marketplace-agent-tools.ts,packages/application/src/platform-inference-router.ts,packages/application/src/agent-purchase-authorization.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0131`    P2    §147    `VERIFIED`   packages/application/src/marketplace-agent-tools.ts,packages/application/src/platform-inference-router.ts,packages/application/src/agent-purchase-authorization.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0132`    P2    §147    `VERIFIED`   packages/application/src/marketplace-agent-tools.ts,packages/application/src/platform-inference-router.ts,packages/application/src/agent-purchase-authorization.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `CAP-0053`    P1    §148    `VERIFIED`   packages/application/src/marketplace-agent-tools.ts,packages/application/src/platform-inference-router.ts,packages/application/src/agent-purchase-authorization.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `CAP-0054`    P1    §148    `VERIFIED`   packages/application/src/marketplace-agent-tools.ts,packages/application/src/platform-inference-router.ts,packages/application/src/agent-purchase-authorization.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0133`    P1    §149    `VERIFIED`   packages/application/src/marketplace-agent-tools.ts,packages/application/src/platform-inference-router.ts,packages/application/src/agent-purchase-authorization.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0134`    P1    §150    `VERIFIED`   apps/web/app/ai-request,apps/web/src/agent,packages/persistence/src/marketplace-agent.ts   tests/browser-m10/marketplace.spec.ts,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0135`    P2    §150    `VERIFIED`   apps/web/app/ai-request,apps/web/src/agent,packages/persistence/src/marketplace-agent.ts   tests/browser-m10/marketplace.spec.ts,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0136`    P2    §150    `VERIFIED`   apps/web/app/ai-request,apps/web/src/agent,packages/persistence/src/marketplace-agent.ts   tests/browser-m10/marketplace.spec.ts,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0137`    P1    §151    `VERIFIED`   apps/web/app/ai-request,apps/web/src/agent,packages/persistence/src/marketplace-agent.ts   tests/browser-m10/marketplace.spec.ts,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0138`    P2    §151    `VERIFIED`   apps/web/app/ai-request,apps/web/src/agent,packages/persistence/src/marketplace-agent.ts   tests/browser-m10/marketplace.spec.ts,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0139`    P2    §151    `VERIFIED`   apps/web/app/ai-request,apps/web/src/agent,packages/persistence/src/marketplace-agent.ts   tests/browser-m10/marketplace.spec.ts,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0140`    P1    §152    `VERIFIED`   apps/web/app/ai-request,apps/web/src/agent,packages/persistence/src/marketplace-agent.ts   tests/browser-m10/marketplace.spec.ts,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0141`    P2    §152    `VERIFIED`   apps/web/app/ai-request,apps/web/src/agent,packages/persistence/src/marketplace-agent.ts   tests/browser-m10/marketplace.spec.ts,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0142`    P1    §153    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/contracts/src/marketplace.ts,apps/web/app/discover   tests/m10-postgres-integration.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0143`    P2    §153    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/contracts/src/marketplace.ts,apps/web/app/discover   tests/m10-postgres-integration.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0144`    P1    §154    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/contracts/src/marketplace.ts,apps/web/app/discover   tests/m10-postgres-integration.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0145`    P2    §154    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/contracts/src/marketplace.ts,apps/web/app/discover   tests/m10-postgres-integration.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0146`    P1    §155    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/contracts/src/marketplace.ts,apps/web/app/discover   tests/m10-postgres-integration.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0147`    P2    §155    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/contracts/src/marketplace.ts,apps/web/app/discover   tests/m10-postgres-integration.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0148`    P2    §155    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/contracts/src/marketplace.ts,apps/web/app/discover   tests/m10-postgres-integration.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `CAP-0055`    P1    §156    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/contracts/src/marketplace.ts,apps/web/app/discover   tests/m10-postgres-integration.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `IO-0045`    P1    §157    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `IO-0046`    P1    §158    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `IO-0047`    P1    §158    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `IO-0048`    P1    §158    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `IO-0049`    P1    §158    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0149`    P1    §159    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0150`    P2    §159    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0151`    P2    §159    `VERIFIED`   packages/domain/src/agent-plan.ts,packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0152`    P1    §160    `OPEN_IMPLEMENTATION`   packages/application/src/agent-purchase-authorization.ts,packages/domain/src/agent-plan.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 implementation/component evidence; full gate OPEN backlog:PRD-0152.

  `PRD-0153`    P2    §160    `OPEN_IMPLEMENTATION`   packages/application/src/agent-purchase-authorization.ts,packages/domain/src/agent-plan.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 implementation/component evidence; full gate OPEN backlog:PRD-0153.

  `PRD-0154`    P2    §160    `OPEN_IMPLEMENTATION`   packages/application/src/agent-purchase-authorization.ts,packages/domain/src/agent-plan.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 implementation/component evidence; full gate OPEN backlog:PRD-0154.

  `PRD-0155`    P1    §161    `OPEN_IMPLEMENTATION`   packages/application/src/agent-purchase-authorization.ts,packages/domain/src/agent-plan.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 implementation/component evidence; full gate OPEN backlog:PRD-0155.

  `PRD-0156`    P2    §161    `OPEN_IMPLEMENTATION`   packages/application/src/agent-purchase-authorization.ts,packages/domain/src/agent-plan.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 implementation/component evidence; full gate OPEN backlog:PRD-0156.

  `PRD-0157`    P1    §162    `OPEN_IMPLEMENTATION`   packages/application/src/agent-purchase-authorization.ts,packages/domain/src/agent-plan.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 implementation/component evidence; full gate OPEN backlog:PRD-0157.

  `PRD-0158`    P2    §162    `OPEN_IMPLEMENTATION`   packages/application/src/agent-purchase-authorization.ts,packages/domain/src/agent-plan.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 implementation/component evidence; full gate OPEN backlog:PRD-0158.

  `PRD-0159`    P1         §163     `DEFERRED_VERIFICATION`   packages/contracts/src/inference.ts tests/inference.test.mjs baseline only;  backlog:PRD-0159

  `PRD-0160`    P2         §163     `DEFERRED_VERIFICATION`   packages/contracts/src/inference.ts tests/inference.test.mjs baseline only;  backlog:PRD-0160

  `PRD-0161`    P2         §163     `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0161

  `PRD-0162`    P2         §163     `DEFERRED_VERIFICATION`   packages/contracts/src/inference.ts tests/inference.test.mjs baseline only;  backlog:PRD-0162

  `AGT-0047`    P1    §164    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0048`    P1    §164    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0049`    P1    §164    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0050`    P1    §165    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0051`    P1    §165    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0052`    P1    §165    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0053`    P1    §165    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0054`    P1    §165    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0055`    P1    §165    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `SEC-0066`    P1    §166    `DEFERRED_VERIFICATION`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 implementation/component evidence; full gate OPEN backlog:SEC-0066.

  `SEC-0067`    P0    §166    `DEFERRED_VERIFICATION`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 implementation/component evidence; full gate OPEN backlog:SEC-0067.

  `SEC-0068`    P0    §166    `VERIFIED`   apps/web/src/agent/inference-server.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `SEC-0069`    P0    §166    `USER_OVERRIDE`   .env.example   tests/env.test.mjs   Earlier direct user instruction requires safe example values and brief comments in .env.example; original names-only wording is superseded for this file, not claimed VERIFIED. See DEC-IMPL-016.

  `AGT-0056`    P1    §167    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0057`    P1    §167    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0058`    P1    §167    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0059`    P1    §167    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0060`    P1    §168    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0061`    P1    §168    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0062`    P1    §168    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0063`    P1    §169    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0064`    P1    §169    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0065`    P1    §170    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0066`    P1    §170    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0067`    P1    §171    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0068`    P1    §171    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0069`    P1    §171    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `IO-0050`    P1    §172    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `IO-0051`    P1    §172    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `IO-0052`    P1    §172    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0070`    P1    §173    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0071`    P1    §173    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0072`    P1    §173    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0073`    P1    §173    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0163`    P1    §174    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0164`    P2    §174    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0165`    P2    §174    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0074`    P1    §175    `DEFERRED_VERIFICATION`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 implementation/component evidence; full gate OPEN backlog:AGT-0074.

  `AGT-0075`    P1    §176    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0076`    P1    §176    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0166`    P1    §177    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0167`    P2    §177    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0168`    P2    §177    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0169`    P2    §177    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0170`    P2    §177    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0171`    P2    §177    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0172`    P1    §178    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0173`    P2    §178    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0174`    P2    §178    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent ,apps/web/app/privacy/page.tsx   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0175`    P1    §179    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0176`    P2    §179    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0177`    P2    §179    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0178`    P2    §179    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0077`    P1    §180    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0078`    P1    §180    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0079`    P1    §181    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent ,packages/persistence/migrations/0020_platform_inference.sql   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0080`    P1    §181    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent ,packages/persistence/migrations/0020_platform_inference.sql   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0081`    P1    §181    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent ,packages/persistence/migrations/0020_platform_inference.sql   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0082`    P1    §181    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent ,packages/persistence/migrations/0020_platform_inference.sql   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0083`    P1    §182    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0084`    P1    §182    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0085`    P1    §182    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `IO-0053`    P1    §183    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `IO-0054`    P1    §183    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `IO-0055`    P1    §183    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `IO-0056`    P1    §183    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `UI-0016`    P1    §184    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `UI-0017`    P2    §184    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `UI-0018`    P2    §184    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0086`    P1    §185    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0087`    P1    §186    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0088`    P1    §186    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0089`    P1    §186    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0090`    P1    §187    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0091`    P1    §187    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0092`    P1    §187    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0093`    P1    §187    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0179`    P1    §188    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0180`    P2    §188    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0181`    P2    §188    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0182`    P2    §188    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `TST-0016`    P1    §189    `DEFERRED_VERIFICATION`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 implementation/component evidence; full gate OPEN backlog:TST-0016.

  `TST-0017`    P2    §189    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `TST-0018`    P2    §189    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0094`    P1    §190    `DEFERRED_VERIFICATION`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 implementation/component evidence; full gate OPEN backlog:AGT-0094.

  `AGT-0095`    P1    §190    `DEFERRED_VERIFICATION`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 implementation/component evidence; full gate OPEN backlog:AGT-0095.

  `AGT-0096`    P1    §190    `DEFERRED_VERIFICATION`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 implementation/component evidence; full gate OPEN backlog:AGT-0096.

  `AGT-0097`    P1    §190    `VERIFIED`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0183`    P1    §191    `DEFERRED_VERIFICATION`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 implementation/component evidence; full gate OPEN backlog:PRD-0183.

  `PRD-0184`    P2    §191    `DEFERRED_VERIFICATION`   packages/infrastructure/contracts/src/platform-inference-ports.ts,packages/infrastructure/adapters/src/openai-platform.ts,packages/infrastructure/adapters/src/anthropic-platform.ts,packages/application/src/platform-inference-router.ts,packages/persistence/src/platform-inference-usage.ts,apps/web/src/agent   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/architecture.test.mjs   M11 implementation/component evidence; full gate OPEN backlog:PRD-0184.

  `IO-0057`     P1         §192     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-io.ts tests/capability-io.test.mjs baseline only;  backlog:IO-0057 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0058`     P1         §192     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-io.ts tests/capability-io.test.mjs baseline only;  backlog:IO-0058 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0059`     P1         §192     `OPEN_IMPLEMENTATION`   packages/contracts/src/contract-values.ts tests/capability-io.test.mjs baseline only;  backlog:IO-0059 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0060`     P1         §192     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-io.ts tests/capability-io.test.mjs baseline only;  backlog:IO-0060 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0061`     P1         §193     `OPEN_IMPLEMENTATION`   ---              ---        backlog:IO-0061 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0062`     P1         §193     `OPEN_IMPLEMENTATION`   ---              ---        backlog:IO-0062 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0063`     P1         §194     `OPEN_IMPLEMENTATION`   ---              ---        backlog:IO-0063 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0064`     P1         §194     `OPEN_IMPLEMENTATION`   ---              ---        backlog:IO-0064 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0065`     P1         §195     `OPEN_IMPLEMENTATION`   ---              ---        backlog:IO-0065 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0066`     P1         §195     `OPEN_IMPLEMENTATION`   ---              ---        backlog:IO-0066 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0067`     P1         §195     `OPEN_IMPLEMENTATION`   ---              ---        backlog:IO-0067 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `UI-0019`     P1         §196     `OPEN_IMPLEMENTATION`   ---              ---        backlog:UI-0019 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0068`     P1         §197    `VERIFIED`   packages/contracts/src/capability-io.ts,packages/application/src/input-object-validation.ts,packages/persistence/src/marketplace-assets.ts,apps/worker/src/input-staging.ts   tests/capability-io.test.mjs,tests/assets.test.mjs,tests/m10-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-buyer-file-input-review.md   Published field limits, detected MIME plus extension, private upload finalization, seller-approved Worker staging and hostile/mismatched input denial pass the real paid file path.

  `IO-0069`     P1         §197    `VERIFIED`   packages/application/src/input-object-validation.ts,packages/persistence/src/marketplace-assets.ts,apps/worker/src/input-staging.ts   tests/input-object-validation.test.mjs,tests/assets.test.mjs,tests/m16-installed-worker-e2e.mjs   Server compares allowed extension with detected object content/MIME before READY and Worker staging, including forged-content rejection.

  `IO-0070`     P1         §197    `VERIFIED`   packages/application/src/input-object-validation.ts,packages/persistence/src/marketplace-assets.ts   tests/input-object-validation.test.mjs,tests/m10-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs   Browser-declared MIME is advisory; final private object bytes are scanned and detected before attachment in the real paid upload path.

  `UI-0020`     P1         §198     `OPEN_IMPLEMENTATION`   packages/contracts/src/media-presets.ts,packages/contracts/src/file-types.ts tests/media-presets.test.mjs preset compiler exists; seller UI OPEN backlog:UI-0020

  `UI-0021`     P2         §198     `OPEN_IMPLEMENTATION`   packages/contracts/src/media-presets.ts,packages/contracts/src/file-types.ts tests/media-presets.test.mjs preset compiler exists; seller UI OPEN backlog:UI-0021

  `IO-0071`    P1         §199     `VERIFIED`   packages/contracts/src/capability-io.ts,packages/contracts/src/contract-values.ts,packages/domain/src/io-compatibility.ts,packages/persistence/src/marketplace-catalog.ts,apps/web/app/capabilities/[slug]/run-form.tsx   tests/fixtures/m16-blender-contract.json,tests/capability-io.test.mjs,tests/m11-agent.test.mjs,tests/browser-m10/media-examples.spec.ts,docs/evidence/m16-canonical-example-contracts.md   Exact illustrative contract passes input/select/output validation, Agent format ranking and unsafe planner mapping denial; buyer Web renders it from the shared versioned catalog at desktop/mobile sizes. API and Worker use those same Core schemas; no Blender installation is implied.

  `PRD-0185`    P1         §200     `OPEN_IMPLEMENTATION`   ---              ---        backlog:PRD-0185 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0072`     P1         §201     `OPEN_IMPLEMENTATION`   ---              ---        backlog:IO-0072 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0073`     P1         §201     `OPEN_IMPLEMENTATION`   ---              ---        backlog:IO-0073 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0074`    P1         §202    `VERIFIED`   apps/web/app/seller/input-contracts/input-contract-builder.tsx,apps/web/app/capabilities/[slug]/run-form.tsx,packages/contracts/src/contract-values.ts,packages/application/src/job-instructions.ts   tests/browser-m12/seller-operations.spec.ts,tests/browser-m10/media-examples.spec.ts,tests/capability-io.test.mjs,tests/job-instructions.test.mjs,docs/evidence/m16-conditional-contract-closure.md   Seller authors and previews a simple condition; authenticated buyer form show/hide and server/Worker hidden-field denial agree.

  `IO-0075`    P1         §202    `VERIFIED`   apps/web/app/seller/input-contracts/input-contract-builder.tsx,apps/web/app/capabilities/[slug]/run-form.tsx,packages/contracts/src/contract-values.ts,packages/application/src/job-instructions.ts   tests/browser-m12/seller-operations.spec.ts,tests/browser-m10/media-examples.spec.ts,tests/capability-io.test.mjs,tests/job-instructions.test.mjs,docs/evidence/m16-conditional-contract-closure.md   Published video field appears only for the selected video mode; server requires it only while visible.

  `IO-0076`    P1         §202    `VERIFIED`   apps/web/app/seller/input-contracts/input-contract-builder.tsx,apps/web/app/capabilities/[slug]/run-form.tsx,packages/contracts/src/contract-values.ts,packages/application/src/job-instructions.ts   tests/browser-m12/seller-operations.spec.ts,tests/browser-m10/media-examples.spec.ts,tests/capability-io.test.mjs,tests/job-instructions.test.mjs,docs/evidence/m16-conditional-contract-closure.md   Only one prior-field equality is authorable; invalid or unreachable conditions fail schema validation.

  `IO-0077`    P1         §203    `VERIFIED`   packages/contracts/src/capability-io.ts,packages/persistence/src/seller-input-contract-drafts.ts,apps/web/app/capabilities/[slug]/run-form.tsx,apps/worker/src/execution-supervisor.ts   tests/browser-m12/seller-operations.spec.ts,tests/browser-m10/media-examples.spec.ts,tests/capability-io.test.mjs,tests/job-instructions.test.mjs,docs/evidence/m16-conditional-contract-closure.md,tests/m16-input-contract-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs   A normalized versioned contract is persisted and drives buyer form, Core validation and Worker execution; no separate field definitions.

  `IO-0078`    P1         §203    `VERIFIED`   packages/contracts/src/capability-io.ts,apps/web/app/capabilities/[slug]/run-form.tsx   tests/browser-m12/seller-operations.spec.ts,tests/browser-m10/media-examples.spec.ts,tests/capability-io.test.mjs,tests/job-instructions.test.mjs,docs/evidence/m16-conditional-contract-closure.md   The marketplace retains a product-specific normalized file/UI-hint contract; optional JSON Schema compilation is not claimed.

  `UI-0022`     P1         §204     `OPEN_IMPLEMENTATION`   ---              ---        backlog:UI-0022

  `IO-0079`     P1         §205     `OPEN_IMPLEMENTATION`   ---              ---        backlog:IO-0079

  `IO-0080`     P1         §205     `OPEN_IMPLEMENTATION`   ---              ---        backlog:IO-0080

  `IO-0081`     P1         §205     `OPEN_IMPLEMENTATION`   ---              ---        backlog:IO-0081

  `PRD-0186`    P1         §206     `OPEN_IMPLEMENTATION`   ---              ---        backlog:PRD-0186 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `CAP-0056`    P1         §207     `OPEN_IMPLEMENTATION`   ---              ---        backlog:CAP-0056 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `PRD-0187`    P1    §208    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-planner.ts,packages/domain/src/agent-plan.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 closes prior deferred gate with current published supply, deterministic constraints and test evidence; docs/milestones/M11.md.

  `PRD-0188`    P2    §208    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-planner.ts,packages/domain/src/agent-plan.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 closes prior deferred gate with current published supply, deterministic constraints and test evidence; docs/milestones/M11.md.

  `PRD-0189`    P2    §208    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-planner.ts,packages/domain/src/agent-plan.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 closes prior deferred gate with current published supply, deterministic constraints and test evidence; docs/milestones/M11.md.

  `IO-0082`    P1         §209    `VERIFIED`   apps/web/app/seller/input-contracts/input-contract-builder.tsx,apps/web/app/capabilities/[slug]/run-form.tsx,packages/contracts/src/contract-values.ts,packages/application/src/job-instructions.ts   tests/browser-m12/seller-operations.spec.ts,tests/browser-m10/media-examples.spec.ts,tests/capability-io.test.mjs,tests/job-instructions.test.mjs,docs/evidence/m16-conditional-contract-closure.md   Seller-authored scalar default persists, appears in authenticated buyer form and is applied again by Core and Worker validation.

  `IO-0083`    P1         §209    `VERIFIED`   packages/contracts/src/capability-io.ts,apps/web/app/seller/input-contracts/input-contract-builder.tsx   tests/browser-m12/seller-operations.spec.ts,tests/browser-m10/media-examples.spec.ts,tests/capability-io.test.mjs,tests/job-instructions.test.mjs,docs/evidence/m16-conditional-contract-closure.md   File and permission defaults cannot be authored; schema rejects file defaultValue and permission policy is separate.

  `CAP-0057`    P1         §210     `OPEN_IMPLEMENTATION`   ---              ---        backlog:CAP-0057 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `CAP-0058`    P1         §210     `OPEN_IMPLEMENTATION`   ---              ---        backlog:CAP-0058 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `CAP-0059`    P1         §210     `OPEN_IMPLEMENTATION`   ---              ---        backlog:CAP-0059 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0084`    P1         §211    `VERIFIED`   packages/contracts/src/capability-io.ts,packages/sandbox-adapter/src/output-collector.ts,apps/worker/src/output-upload.ts,packages/persistence/src/job-execution.ts   tests/capability-io.test.mjs,tests/output-collector.test.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-capability-contract-boundary.md   Seller-approved versioned output fields and optional fields validate in the real Docker/OpenClaw collector; Core commits private assets and DELIVERED only after validation, with buyer retrieval after reconnect.

  `IO-0085`    P1         §211    `VERIFIED`   packages/contracts/src/capability-io.ts,packages/sandbox-adapter/src/output-collector.ts,apps/worker/src/output-upload.ts,packages/persistence/src/job-execution.ts   tests/capability-io.test.mjs,tests/output-collector.test.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-capability-contract-boundary.md   Seller-approved versioned output fields and optional fields validate in the real Docker/OpenClaw collector; Core commits private assets and DELIVERED only after validation, with buyer retrieval after reconnect.

  `IO-0086`    P1         §211    `VERIFIED`   packages/contracts/src/capability-io.ts,packages/sandbox-adapter/src/output-collector.ts,apps/worker/src/output-upload.ts,packages/persistence/src/job-execution.ts   tests/capability-io.test.mjs,tests/output-collector.test.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-capability-contract-boundary.md   Seller-approved versioned output fields and optional fields validate in the real Docker/OpenClaw collector; Core commits private assets and DELIVERED only after validation, with buyer retrieval after reconnect.

  `IO-0087`    P1         §211    `VERIFIED`   packages/contracts/src/local-result.ts,packages/sandbox-adapter/src/output-collector.ts,apps/worker/src/output-upload.ts,packages/persistence/src/job-execution.ts   tests/output-collector.test.mjs,tests/docker-output-storage-local-integration.mjs,tests/m16-installed-worker-e2e.mjs   Missing required output fails collector validation; real Worker output with all required fields/files reaches private storage and DELIVERED only after Core finalization, then authenticated buyer download after reconnect.

  `IO-0088`    P1         §212     `VERIFIED`   packages/contracts/src/local-result.ts,packages/sandbox-adapter/src/output-collector.ts,packages/sandbox-adapter/src/output-transfer.ts,apps/worker/src/output-upload.ts,packages/persistence/src/job-execution.ts   tests/local-result.test.mjs,tests/output-collector.test.mjs,tests/docker-sandbox-output-local-integration.mjs,tests/m16-installed-worker-e2e.mjs   Real Docker/OpenClaw result.json is parsed, validated against the frozen output contract, canonicalized, privately uploaded, replaced by asset IDs and finalized; buyer downloads two declared files after one paid settlement.

  `IO-0089`    P1         §212     `VERIFIED`   packages/sandbox-adapter/src/docker.ts,packages/sandbox-adapter/src/output-collector.ts   tests/docker-sandbox-output-local-integration.mjs,tests/m16-installed-worker-e2e.mjs   Isolated capability writes /job/output/result.json and declared files there; stopped-container collector reads only that output root and cleans it after delivery.

  `IO-0090`    P1         §212     `VERIFIED`   packages/contracts/src/local-result.ts,packages/sandbox-adapter/src/output-collector.ts,packages/sandbox-adapter/src/output-transfer.ts,apps/worker/src/output-upload.ts   tests/local-result.test.mjs,tests/docker-sandbox-output-local-integration.mjs,tests/m16-installed-worker-e2e.mjs   Manifest paths are canonicalized under the stopped sandbox output root, symlink/oversize/traversal attacks fail, and only validated declared files become buyer-authorized asset IDs in a real paid job.

  `IO-0091`     P1         §213     `DEFERRED_VERIFICATION`   packages/application/src/job-instructions.ts tests/job-instructions.test.mjs fixed envelope exists; OpenClaw runtime consumer OPEN backlog:IO-0091

  `IO-0092`     P1         §213     `DEFERRED_VERIFICATION`   packages/application/src/job-instructions.ts tests/job-instructions.test.mjs fixed envelope exists; OpenClaw runtime consumer OPEN backlog:IO-0092

  `IO-0093`     P1         §213     `DEFERRED_VERIFICATION`   packages/application/src/job-instructions.ts tests/job-instructions.test.mjs fixed output instructions; real OpenClaw test OPEN backlog:IO-0093

  `IO-0094`     P1         §213     `DEFERRED_VERIFICATION`   packages/application/src/job-instructions.ts tests/job-instructions.test.mjs fixed path rules; real OpenClaw test OPEN backlog:IO-0094

  `IO-0095`     P1         §214     `OPEN_IMPLEMENTATION`   packages/application/src/job-instructions.ts tests/job-instructions.test.mjs binary references separate from prompt; runtime OPEN backlog:IO-0095

  `IO-0096`     P1         §214     `OPEN_IMPLEMENTATION`   packages/application/src/job-instructions.ts tests/job-instructions.test.mjs binary references separate from prompt; runtime OPEN backlog:IO-0096

  `IO-0097`     P1         §214     `OPEN_IMPLEMENTATION`   packages/application/src/job-instructions.ts tests/job-instructions.test.mjs contract file typing exists; dependency/runtime parity OPEN backlog:IO-0097

  `IO-0098`     P1         §215     `OPEN_IMPLEMENTATION`   packages/domain/src/io-readiness.ts tests/io-readiness.test.mjs format publication blockers exist; dependency handler check OPEN backlog:IO-0098

  `IO-0099`     P1         §215     `OPEN_IMPLEMENTATION`   packages/domain/src/io-readiness.ts tests/io-readiness.test.mjs obvious format contradiction detected; runtime dependency check OPEN backlog:IO-0099

  `IO-0100`     P1         §215     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-test-case.ts,packages/domain/src/io-readiness.ts tests/capability-test-case.test.mjs,tests/io-readiness.test.mjs output assertions modeled; execution test runner OPEN backlog:IO-0100

  `IO-0101`     P1         §215     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-test-case.ts tests/capability-test-case.test.mjs typed expected output; publication test gate OPEN backlog:IO-0101

  `IO-0102`    P1         §216     `OPEN_IMPLEMENTATION`   packages/contracts/src/file-types.ts,packages/application/src/input-object-validation.ts,packages/sandbox-adapter/src/output-collector.ts tests/input-object-validation.test.mjs,tests/output-collector.test.mjs paired MIME/extension checks pass; upload API and broader safety scan OPEN backlog:IO-0102

  `IO-0103`    P1         §216     `OPEN_IMPLEMENTATION`   packages/contracts/src/file-types.ts,packages/application/src/input-object-validation.ts,packages/sandbox-adapter/src/output-collector.ts tests/input-object-validation.test.mjs,tests/output-collector.test.mjs paired MIME/extension checks pass; upload API and broader safety scan OPEN backlog:IO-0103

  `IO-0104`     P1         §217     `OPEN_IMPLEMENTATION`   packages/contracts/src/file-types.ts,packages/sandbox-adapter/src/output-collector.ts tests/input-object-validation.test.mjs,tests/output-collector.test.mjs archives fail closed; explicit safe extraction OPEN backlog:IO-0104

  `IO-0105`     P1         §217     `OPEN_IMPLEMENTATION`   packages/contracts/src/file-types.ts,packages/sandbox-adapter/src/output-collector.ts tests/input-object-validation.test.mjs,tests/output-collector.test.mjs archives fail closed; publication policy OPEN backlog:IO-0105

  `IO-0106`     P1         §217     `OPEN_IMPLEMENTATION`   packages/domain/src/io-readiness.ts tests/io-readiness.test.mjs archives are unsupported until safe extraction; publish gate OPEN backlog:IO-0106

  `IO-0107`    P1         §218     `DEFERRED_VERIFICATION`   packages/infrastructure/s3/src/storage.ts,apps/worker/src/output-upload.ts tests/s3-storage-local-integration.mjs,tests/docker-output-storage-local-integration.mjs real Docker-to-private-storage stream passes; direct buyer upload/API/multipart OPEN backlog:IO-0107 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0108`    P1         §218     `DEFERRED_VERIFICATION`   packages/infrastructure/s3/src/storage.ts,apps/worker/src/output-upload.ts tests/s3-storage-local-integration.mjs,tests/docker-output-storage-local-integration.mjs real Docker-to-private-storage stream passes; direct buyer upload/API/multipart OPEN backlog:IO-0108 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0109`    P1         §218     `DEFERRED_VERIFICATION`   packages/infrastructure/s3/src/storage.ts,apps/worker/src/output-upload.ts tests/s3-storage-local-integration.mjs,tests/docker-output-storage-local-integration.mjs real Docker-to-private-storage stream passes; direct buyer upload/API/multipart OPEN backlog:IO-0109 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0110`    P1         §218     `DEFERRED_VERIFICATION`   packages/infrastructure/s3/src/storage.ts,apps/worker/src/output-upload.ts,apps/worker/src/input-staging.ts tests/docker-output-storage-local-integration.mjs,tests/input-staging.test.mjs Worker streaming passes; browser large-file/multipart E2E OPEN backlog:IO-0110 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `CAP-0060`    P1         §219     `OPEN_IMPLEMENTATION`   packages/contracts/src/file-limits.ts,packages/contracts/src/capability-io.ts tests/media-presets.test.mjs central policy/schema; UI and runtime parity OPEN backlog:CAP-0060

  `CAP-0061`    P1         §219     `OPEN_IMPLEMENTATION`   packages/contracts/src/file-limits.ts,packages/contracts/src/capability-io.ts tests/media-presets.test.mjs central policy/schema; UI and runtime parity OPEN backlog:CAP-0061

  `CAP-0062`    P1         §219     `OPEN_IMPLEMENTATION`   packages/contracts/src/file-limits.ts,packages/contracts/src/capability-io.ts tests/media-presets.test.mjs central policy/schema; deployment configuration OPEN backlog:CAP-0062

  `IO-0111`     P1         §220     `DEFERRED_VERIFICATION`   ---              ---        backlog:IO-0111

  `IO-0112`     P1         §220     `DEFERRED_VERIFICATION`   ---              ---        backlog:IO-0112

  `IO-0113`     P1         §221     `DEFERRED_VERIFICATION`   packages/contracts/src/capability-version.ts,packages/domain/src/io-compatibility.ts tests/capability-version.test.mjs,tests/io-compatibility.test.mjs version snapshot/classification; published revision flow OPEN backlog:IO-0113

  `IO-0114`     P1         §222     `OPEN_IMPLEMENTATION`   packages/domain/src/io-compatibility.ts tests/io-compatibility.test.mjs pure classification; publication migration OPEN backlog:IO-0114 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0115`     P1         §222     `OPEN_IMPLEMENTATION`   packages/domain/src/io-compatibility.ts tests/io-compatibility.test.mjs required-field breaking classification passes; persisted version/history OPEN backlog:IO-0115 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0116`     P1         §222     `OPEN_IMPLEMENTATION`   packages/domain/src/io-compatibility.ts tests/io-compatibility.test.mjs required-output breaking classification passes; persisted version/history OPEN backlog:IO-0116 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0117`    P1    §223    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-planner.ts,packages/domain/src/agent-plan.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 closes prior deferred gate with current published supply, deterministic constraints and test evidence; docs/milestones/M11.md.

  `PRD-0190`    P1         §224     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-io.ts,packages/domain/src/io-compatibility.ts tests/io-compatibility.test.mjs semantic tags constrain mapping; Agent/UI OPEN backlog:PRD-0190 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `PRD-0191`    P2         §224     `OPEN_IMPLEMENTATION`   packages/domain/src/io-compatibility.ts tests/io-compatibility.test.mjs semantic uncertainty represented; Agent/UI OPEN backlog:PRD-0191 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0118`    P1         §225     `DEFERRED_VERIFICATION`   packages/contracts/src/assets.ts,packages/domain/src/assets.ts,packages/persistence/migrations/0010_private_assets.sql tests/assets.test.mjs,tests/sql/m05_assets.sql baseline only; full asset flow OPEN backlog:IO-0118 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0119`    P1         §225      `VERIFIED`   packages/persistence/src/marketplace-assets.ts,packages/persistence/src/marketplace-buyer.ts,apps/web/src/buyer-api/handler.ts   tests/m13-postgres-integration.mjs   Buyer-owned input/output access and signed Worker input grants enforce owner and job scope.

  `IO-0120`    P1         §225      `VERIFIED`   packages/persistence/src/marketplace-assets.ts,packages/persistence/src/marketplace-buyer.ts,apps/web/src/buyer-api/handler.ts   tests/m13-postgres-integration.mjs   Other buyer guessed input/output asset IDs return 404; private bytes stay inaccessible.

  `IO-0121`    P1         §226     `VERIFIED`   packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/job-execution.ts,packages/persistence/migrations/0031_explicit_read_only_asset_grants.sql   tests/m11-postgres-integration.mjs,tests/sql/m05_assets.sql   M16 distinct-seller and distinct-Worker paid DAG PostgreSQL test proves one READ-only target grant, no duplicate object, no source metadata or unrelated Worker access, expiry and one-way revocation; docs/evidence/m16-cross-job-grants.md.

  `IO-0122`    P1         §226     `VERIFIED`   packages/application/src/agent-purchase-authorization.ts,packages/persistence/src/job-execution.ts   tests/m11-postgres-integration.mjs   M16 distinct-seller and distinct-Worker paid DAG PostgreSQL test proves one READ-only target grant, no duplicate object, no source metadata or unrelated Worker access, expiry and one-way revocation; docs/evidence/m16-cross-job-grants.md.

  `IO-0123`    P1         §226     `VERIFIED`   packages/persistence/src/job-execution.ts,packages/persistence/migrations/0031_explicit_read_only_asset_grants.sql   tests/m11-postgres-integration.mjs   M16 distinct-seller and distinct-Worker paid DAG PostgreSQL test proves one READ-only target grant, no duplicate object, no source metadata or unrelated Worker access, expiry and one-way revocation; docs/evidence/m16-cross-job-grants.md.

  `IO-0124`    P1         §226     `VERIFIED`   packages/persistence/src/job-execution.ts,packages/persistence/migrations/0031_explicit_read_only_asset_grants.sql   tests/m11-postgres-integration.mjs   M16 distinct-seller and distinct-Worker paid DAG PostgreSQL test proves one READ-only target grant, no duplicate object, no source metadata or unrelated Worker access, expiry and one-way revocation; docs/evidence/m16-cross-job-grants.md.

  `PRD-0192`    P1         §227     `VERIFIED`   apps/web/app/capabilities/[slug]/page.tsx,apps/web/app/capabilities/[slug]/run-form.tsx   tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-authentic-browser-review.md   Full §227 review: authentic buyer sees processing location, stronger warning before Web upload and an explicit no-confidential-computing statement.

  `PRD-0193`    P2         §227     `VERIFIED`   apps/web/app/capabilities/[slug]/page.tsx   tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-browser/m16-buyer-privacy-desktop.png   Authenticated buyer detail explains seller-machine processing before the input form.

  `PRD-0194`    P2         §227     `VERIFIED`   apps/web/app/capabilities/[slug]/run-form.tsx   tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-browser/m16-buyer-sensitive-warning-mobile.png   Stronger warning renders before all inputs; authenticated browser checks it before the private file upload.

  `PRD-0195`    P2         §227     `VERIFIED`   apps/web/app/capabilities/[slug]/page.tsx,apps/web/app/capabilities/[slug]/run-form.tsx   tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-authentic-browser-review.md   Detail and pre-upload warning explicitly reject a confidential-computing claim.

  `IO-0125`     P1         §228     `DEFERRED_VERIFICATION`   packages/persistence/migrations/0012_asset_retention_guards.sql tests/sql/m05_assets.sql retention extension/grant constraints; sweeper and buyer UI OPEN backlog:IO-0125 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0126`     P1         §228     `DEFERRED_VERIFICATION`   ---              ---        backlog:IO-0126 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0127`     P1         §228     `DEFERRED_VERIFICATION`   packages/persistence/migrations/0012_asset_retention_guards.sql tests/sql/m05_assets.sql cloud grant lifetime guard; Worker local cleanup policy OPEN backlog:IO-0127 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `PRD-0196`    P1         §229     `OPEN_IMPLEMENTATION`   ---              ---        backlog:PRD-0196

  `PRD-0197`    P2         §229     `OPEN_IMPLEMENTATION`   ---              ---        backlog:PRD-0197

  `IO-0128`     P1         §230     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-test-case.ts tests/capability-test-case.test.mjs test-case contract exists; persistence and runner OPEN backlog:IO-0128

  `IO-0129`     P1         §230     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-test-case.ts tests/capability-test-case.test.mjs test-case contract exists; seller authoring and runner OPEN backlog:IO-0129

  `TST-0019`    P1         §231    `VERIFIED`   packages/sandbox-adapter/src/output-collector.ts,apps/worker/src/output-upload.ts,apps/web/app/buyer/jobs   tests/m16-installed-worker-e2e.mjs,tests/output-collector.test.mjs   Real paid valid output is technically delivered and settled once; the buyer separately reports a QUALITY issue without mutating settlement. Rejected output/storage leaves no manifest or settlement and releases credits.

  `PAY-0078`    P1         §232     `OPEN_IMPLEMENTATION`   ---              ---        backlog:PAY-0078 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `PAY-0079`    P0         §232     `OPEN_IMPLEMENTATION`   ---              ---        backlog:PAY-0079 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `PAY-0080`    P0         §232     `OPEN_IMPLEMENTATION`   ---              ---        backlog:PAY-0080 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `PRD-0198`    P1    §233    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-planner.ts,packages/domain/src/agent-plan.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 closes prior deferred gate with current published supply, deterministic constraints and test evidence; docs/milestones/M11.md.

  `PRD-0199`    P2    §233    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-planner.ts,packages/domain/src/agent-plan.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 closes prior deferred gate with current published supply, deterministic constraints and test evidence; docs/milestones/M11.md.

  `PRD-0200`    P2    §233    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-planner.ts,packages/domain/src/agent-plan.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 closes prior deferred gate with current published supply, deterministic constraints and test evidence; docs/milestones/M11.md.

  `PRD-0201`    P2    §233    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-planner.ts,packages/domain/src/agent-plan.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 closes prior deferred gate with current published supply, deterministic constraints and test evidence; docs/milestones/M11.md.

  `IO-0130`    P1         §234      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts,tests/m09-postgres-integration.mjs   Current I/O contract drives concise card input/output badges

  `IO-0131`     P1         §235     `OPEN_IMPLEMENTATION`   ---              ---        backlog:IO-0131 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open. M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `IO-0132`     P1         §235     `OPEN_IMPLEMENTATION`   ---              ---        backlog:IO-0132 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open. M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `PRD-0202`    P1         §236     `OPEN_IMPLEMENTATION`   ---              ---        backlog:PRD-0202 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `PRD-0203`    P2         §236     `OPEN_IMPLEMENTATION`   ---              ---        backlog:PRD-0203 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `PRD-0204`    P1         §237     `OPEN_IMPLEMENTATION`   packages/contracts/src/internet-policy.ts,packages/policy-engine/src/public-destination.ts,packages/policy-engine/src/sandbox.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   partial M06 evidence; backlog:PRD-0204

  `PRD-0205`    P2         §237     `OPEN_IMPLEMENTATION`   packages/contracts/src/internet-policy.ts,packages/policy-engine/src/public-destination.ts,packages/policy-engine/src/sandbox.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   partial M06 evidence; backlog:PRD-0205

  `PRD-0206`    P2         §237     `OPEN_IMPLEMENTATION`   packages/contracts/src/internet-policy.ts,packages/policy-engine/src/public-destination.ts,packages/policy-engine/src/sandbox.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   partial M06 evidence; backlog:PRD-0206

  `PRD-0207`    P2         §237     `OPEN_IMPLEMENTATION`   packages/contracts/src/internet-policy.ts,packages/policy-engine/src/public-destination.ts,packages/policy-engine/src/sandbox.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   partial M06 evidence; backlog:PRD-0207

  `PRD-0208`    P2         §237     `OPEN_IMPLEMENTATION`   packages/contracts/src/internet-policy.ts,packages/policy-engine/src/public-destination.ts,packages/policy-engine/src/sandbox.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   partial M06 evidence; backlog:PRD-0208

  `PRD-0209`    P1         §238     `OPEN_IMPLEMENTATION`   packages/contracts/src/internet-policy.ts,packages/policy-engine/src/public-destination.ts,packages/policy-engine/src/sandbox.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   partial M06 evidence; backlog:PRD-0209

  `PRD-0210`    P2         §238     `OPEN_IMPLEMENTATION`   packages/contracts/src/internet-policy.ts,packages/policy-engine/src/public-destination.ts,packages/policy-engine/src/sandbox.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   partial M06 evidence; backlog:PRD-0210

  `PRD-0211`    P2         §238     `OPEN_IMPLEMENTATION`   packages/contracts/src/internet-policy.ts,packages/policy-engine/src/public-destination.ts,packages/policy-engine/src/sandbox.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   partial M06 evidence; backlog:PRD-0211

  `PRD-0212`    P2         §238     `OPEN_IMPLEMENTATION`   packages/contracts/src/internet-policy.ts,packages/policy-engine/src/public-destination.ts,packages/policy-engine/src/sandbox.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   partial M06 evidence; backlog:PRD-0212

  `SEC-0070`    P1         §239     `OPEN_IMPLEMENTATION`   packages/contracts/src/internet-policy.ts,packages/policy-engine/src/public-destination.ts,packages/policy-engine/src/sandbox.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   partial M06 evidence; backlog:SEC-0070

  `SEC-0071`    P0         §239     `OPEN_IMPLEMENTATION`   packages/contracts/src/internet-policy.ts,packages/policy-engine/src/public-destination.ts,packages/policy-engine/src/sandbox.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   partial M06 evidence; backlog:SEC-0071

  `SEC-0072`    P0         §239     `OPEN_IMPLEMENTATION`   packages/contracts/src/internet-policy.ts,packages/policy-engine/src/public-destination.ts,packages/policy-engine/src/sandbox.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   partial M06 evidence; backlog:SEC-0072

  `PRD-0213`    P1         §240     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/infrastructure/http/src/brave-search.ts   tests/research-broker.test.mjs   partial M06 evidence; backlog:PRD-0213

  `PRD-0214`    P1         §241     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/infrastructure/http/src/brave-search.ts   tests/research-broker.test.mjs   partial M06 evidence; backlog:PRD-0214

  `PRD-0215`    P2         §241     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/infrastructure/http/src/brave-search.ts   tests/research-broker.test.mjs   partial M06 evidence; backlog:PRD-0215

  `PRD-0216`    P2         §241     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/infrastructure/http/src/brave-search.ts   tests/research-broker.test.mjs   partial M06 evidence; backlog:PRD-0216

  `UI-0023`    P1         §242     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts,packages/infrastructure/http/src/pinned-http.ts   tests/research-broker.test.mjs,tools/test-m06-public-fetch.mjs   partial M06 evidence; backlog:UI-0023

  `SEC-0073`    P1         §243     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts,packages/infrastructure/http/src/pinned-http.ts   tests/research-broker.test.mjs,tools/test-m06-public-fetch.mjs   partial M06 evidence; backlog:SEC-0073

  `SEC-0074`    P0         §243     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts,packages/infrastructure/http/src/pinned-http.ts   tests/research-broker.test.mjs,tools/test-m06-public-fetch.mjs   partial M06 evidence; backlog:SEC-0074

  `SEC-0075`    P0         §243     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts,packages/infrastructure/http/src/pinned-http.ts   tests/research-broker.test.mjs,tools/test-m06-public-fetch.mjs   partial M06 evidence; backlog:SEC-0075

  `PRD-0217`    P1         §244     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts,packages/infrastructure/http/src/pinned-http.ts   tests/research-broker.test.mjs,tools/test-m06-public-fetch.mjs   partial M06 evidence; backlog:PRD-0217

  `PRD-0218`    P2         §244     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts,packages/infrastructure/http/src/pinned-http.ts   tests/research-broker.test.mjs,tools/test-m06-public-fetch.mjs   partial M06 evidence; backlog:PRD-0218

  `PRD-0219`    P2         §244     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts,packages/infrastructure/http/src/pinned-http.ts   tests/research-broker.test.mjs,tools/test-m06-public-fetch.mjs   partial M06 evidence; backlog:PRD-0219

  `PRD-0220`    P1         §245     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts,packages/infrastructure/http/src/pinned-http.ts   tests/research-broker.test.mjs,tools/test-m06-public-fetch.mjs   partial M06 evidence; backlog:PRD-0220

  `PRD-0221`    P2         §245     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts,packages/infrastructure/http/src/pinned-http.ts   tests/research-broker.test.mjs,tools/test-m06-public-fetch.mjs   partial M06 evidence; backlog:PRD-0221

  `PRD-0222`    P2         §245     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts,packages/infrastructure/http/src/pinned-http.ts   tests/research-broker.test.mjs,tools/test-m06-public-fetch.mjs   partial M06 evidence; backlog:PRD-0222

  `PRD-0223`    P2         §245     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts,packages/infrastructure/http/src/pinned-http.ts   tests/research-broker.test.mjs,tools/test-m06-public-fetch.mjs   partial M06 evidence; backlog:PRD-0223

  `PRD-0224`    P1         §246     `OPEN_IMPLEMENTATION`   packages/contracts/src/internet-policy.ts,packages/contracts/src/permission-policy.ts,packages/policy-engine/src/permission-diff.ts   tests/research-broker.test.mjs,tests/permission-diff.test.mjs   partial M06 evidence; backlog:PRD-0224

  `CAP-0063`    P1         §247     `OPEN_IMPLEMENTATION`   packages/contracts/src/internet-policy.ts,packages/contracts/src/permission-policy.ts,packages/policy-engine/src/permission-diff.ts   tests/research-broker.test.mjs,tests/permission-diff.test.mjs   partial M06 evidence; backlog:CAP-0063

  `CAP-0064`    P1         §247     `OPEN_IMPLEMENTATION`   packages/contracts/src/internet-policy.ts,packages/contracts/src/permission-policy.ts,packages/policy-engine/src/permission-diff.ts   tests/research-broker.test.mjs,tests/permission-diff.test.mjs   partial M06 evidence; backlog:CAP-0064

  `SEC-0076`    P1         §248     `OPEN_IMPLEMENTATION`   packages/contracts/src/internet-policy.ts,packages/contracts/src/permission-policy.ts,packages/policy-engine/src/permission-diff.ts   tests/research-broker.test.mjs,tests/permission-diff.test.mjs   partial M06 evidence; backlog:SEC-0076

  `SEC-0077`    P0         §248     `OPEN_IMPLEMENTATION`   packages/contracts/src/internet-policy.ts,packages/contracts/src/permission-policy.ts,packages/policy-engine/src/permission-diff.ts   tests/research-broker.test.mjs,tests/permission-diff.test.mjs   partial M06 evidence; backlog:SEC-0077

  `PRD-0225`    P1         §249     `OPEN_IMPLEMENTATION`   packages/contracts/src/internet-policy.ts,packages/contracts/src/permission-policy.ts,packages/policy-engine/src/permission-diff.ts   tests/research-broker.test.mjs,tests/permission-diff.test.mjs   partial M06 evidence; backlog:PRD-0225

  `PRD-0226`    P2         §249     `OPEN_IMPLEMENTATION`   packages/contracts/src/internet-policy.ts,packages/contracts/src/permission-policy.ts,packages/policy-engine/src/permission-diff.ts   tests/research-broker.test.mjs,tests/permission-diff.test.mjs   partial M06 evidence; backlog:PRD-0226

  `PRD-0227`    P2         §249     `OPEN_IMPLEMENTATION`   packages/contracts/src/internet-policy.ts,packages/contracts/src/permission-policy.ts,packages/policy-engine/src/permission-diff.ts   tests/research-broker.test.mjs,tests/permission-diff.test.mjs   partial M06 evidence; backlog:PRD-0227

  `IO-0133`    P1         §250     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts   tests/research-broker.test.mjs   partial M06 evidence; backlog:IO-0133

  `IO-0134`    P1         §250     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts   tests/research-broker.test.mjs   partial M06 evidence; backlog:IO-0134

  `IO-0135`    P1         §250     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts   tests/research-broker.test.mjs   partial M06 evidence; backlog:IO-0135

  `PRD-0228`    P1         §251     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts   tests/research-broker.test.mjs   partial M06 evidence; backlog:PRD-0228

  `PRD-0229`    P2         §251     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts   tests/research-broker.test.mjs   partial M06 evidence; backlog:PRD-0229

  `PRD-0230`    P2         §251     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts   tests/research-broker.test.mjs   partial M06 evidence; backlog:PRD-0230

  `SEC-0078`    P1         §252     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/sandbox.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   partial M06 evidence; backlog:SEC-0078

  `SEC-0079`    P0         §252     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/sandbox.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   partial M06 evidence; backlog:SEC-0079

  `SEC-0080`    P0         §252     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/sandbox.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   partial M06 evidence; backlog:SEC-0080

  `SEC-0081`    P0         §252     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/sandbox.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   partial M06 evidence; backlog:SEC-0081

  `PRD-0231`    P1         §253     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/sandbox.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   partial M06 evidence; backlog:PRD-0231

  `PRD-0232`    P2         §253     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/sandbox.ts   tests/research-broker.test.mjs,tests/docker-sandbox-local-integration.mjs   partial M06 evidence; backlog:PRD-0232

  `PRD-0233`    P1         §254     `DEFERRED_VERIFICATION`   packages/persistence/migrations/0013_research_broker.sql,packages/persistence/src/research-usage.ts   tests/m06-postgres-integration.mjs   partial M06 evidence; backlog:PRD-0233

  `PRD-0234`    P2         §254     `DEFERRED_VERIFICATION`   packages/persistence/migrations/0013_research_broker.sql,packages/persistence/src/research-usage.ts   tests/m06-postgres-integration.mjs   partial M06 evidence; backlog:PRD-0234

  `PRD-0235`    P1         §255     `DEFERRED_VERIFICATION`   packages/persistence/src/research-usage.ts   tests/m06-postgres-integration.mjs   partial M06 evidence; backlog:PRD-0235

  `PRD-0236`    P1         §256     `DEFERRED_VERIFICATION`   packages/persistence/migrations/0013_research_broker.sql,packages/application/src/provider-broker.ts   tests/m06-postgres-integration.mjs,tests/provider-broker.test.mjs   partial M06 evidence; backlog:PRD-0236 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `PRD-0237`    P1         §257     `OPEN_IMPLEMENTATION`   packages/contracts/src/internet-policy.ts   tests/research-broker.test.mjs   partial M06 evidence; backlog:PRD-0237

  `PRD-0238`    P2         §257     `OPEN_IMPLEMENTATION`   packages/contracts/src/internet-policy.ts   tests/research-broker.test.mjs   partial M06 evidence; backlog:PRD-0238

  `PRD-0239`    P1         §258     `OPEN_IMPLEMENTATION`   ---   ---   partial M06 evidence; backlog:PRD-0239 M10 component: apps/web/src/marketplace,apps/web/app/discover,apps/web/app/buyer; tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts; full gate OPEN.

  `PRD-0240`    P1         §259     `VERIFIED`   packages/application/src/research-broker.ts,packages/contracts/src/contract-values.ts,apps/web/app/discover/safe-result.tsx   tests/capability-io.test.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-research-sources.md   M16 real brokered paid development-credit Docker/OpenClaw job finalized optional sources and displayed escaped provenance to a distinct buyer; no-sources version remains valid.

  `PRD-0241`    P2         §259     `VERIFIED`   packages/contracts/src/io-contract.ts,apps/web/app/capabilities/[slug]/page.tsx   tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-capability-principle.md   M16 current-tree paid Docker/OpenClaw published-version E2E passed 2/2; original §119/§259 review: docs/evidence/m16-capability-principle.md.

  `PRD-0242`    P1         §260     `VERIFIED`   packages/application/src/research-broker.ts,packages/openclaw-adapter/src/job-config.ts,packages/sandbox-adapter/src/docker.ts,packages/persistence/src/marketplace-catalog.ts   tests/fixtures/m06-advertising-capability.json,tests/fixtures/m16-video-ad/SKILL.md,tests/docker-openclaw-advertising-local-integration.mjs,tests/browser-m10/media-examples.spec.ts,docs/evidence/m16-canonical-example-contracts.md   Canonical seller video-ad fixture runs pinned private skill, bounded public research and validated 60-second MP4/Markdown/sources through real Docker/OpenClaw; buyer listing renders the exact contract. Generic paid publication/storage/ledger path has separate installed E2E evidence; no commercial generator or Stripe ad purchase is claimed.

  `PRD-0243`    P2         §260     `VERIFIED`   packages/contracts/src/capability-io.ts,packages/contracts/src/contract-values.ts,tests/fixtures/m06-advertising-capability.json   tests/research-fixture.test.mjs   M16 original individual criterion: canonical video-ad I/O contract requires companyName SHORT_TEXT; shared input validator accepts a real value and rejects omission. Full §260 integration fixture remains open separately.

  `PRD-0244`    P2         §260     `VERIFIED`   tests/fixtures/m06-advertising-capability.json,tests/fixtures/m16-video-ad/SKILL.md,packages/openclaw-adapter/src/job-config.ts   tests/docker-openclaw-advertising-local-integration.mjs,tests/browser-m10/media-examples.spec.ts,docs/evidence/m16-canonical-example-contracts.md   Canonical integration fixture exercises the reviewed private seller skill with public research, declared I/O and a validated 60-second MP4 in real pinned Docker/OpenClaw, plus rendered buyer contract.

  `PRD-0245`    P1         §261     `OPEN_IMPLEMENTATION`   packages/application/src/local-resource-broker.ts,packages/persistence/src/research-usage.ts   tests/m06-postgres-integration.mjs   partial M06 evidence; backlog:PRD-0245

  `PRD-0246`    P2         §261     `OPEN_IMPLEMENTATION`   packages/application/src/local-resource-broker.ts,packages/persistence/src/research-usage.ts   tests/m06-postgres-integration.mjs   partial M06 evidence; backlog:PRD-0246

  `PRD-0247`    P2         §261     `OPEN_IMPLEMENTATION`   packages/application/src/local-resource-broker.ts,packages/persistence/src/research-usage.ts   tests/m06-postgres-integration.mjs   partial M06 evidence; backlog:PRD-0247

  `PRD-0248`    P1         §262     `OPEN_IMPLEMENTATION`   packages/application/src/local-resource-broker.ts,packages/persistence/src/research-usage.ts   tests/m06-postgres-integration.mjs   partial M06 evidence; backlog:PRD-0248

  `PRD-0249`    P2         §262     `OPEN_IMPLEMENTATION`   packages/application/src/local-resource-broker.ts,packages/persistence/src/research-usage.ts   tests/m06-postgres-integration.mjs   partial M06 evidence; backlog:PRD-0249

  `PRD-0250`    P2         §262     `OPEN_IMPLEMENTATION`   packages/application/src/local-resource-broker.ts,packages/persistence/src/research-usage.ts   tests/m06-postgres-integration.mjs   partial M06 evidence; backlog:PRD-0250

  `API-0005`    P1         §263     `OPEN_IMPLEMENTATION`   packages/application/src/declared-api-broker.ts,packages/persistence/src/declared-api-usage.ts   tests/declared-api-broker.test.mjs,tests/m06-postgres-integration.mjs   partial M06 evidence; backlog:API-0005

  `API-0006`    P1         §263     `OPEN_IMPLEMENTATION`   packages/application/src/declared-api-broker.ts,packages/persistence/src/declared-api-usage.ts   tests/declared-api-broker.test.mjs,tests/m06-postgres-integration.mjs   partial M06 evidence; backlog:API-0006

  `API-0007`    P1         §263     `OPEN_IMPLEMENTATION`   packages/application/src/declared-api-broker.ts,packages/persistence/src/declared-api-usage.ts   tests/declared-api-broker.test.mjs,tests/m06-postgres-integration.mjs   partial M06 evidence; backlog:API-0007

  `PRD-0251`    P1         §264     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts   tests/research-fixture.test.mjs   partial M06 evidence; backlog:PRD-0251

  `PRD-0252`    P2         §264     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts   tests/research-fixture.test.mjs   partial M06 evidence; backlog:PRD-0252

  `PRD-0253`    P1         §265     `DEFERRED_VERIFICATION`   packages/application/src/research-broker.ts   tests/research-broker.test.mjs   Shared pinned public Research Broker, robots/access/rate enforcement and buyer disclosure exist; independent publisher terms/copyright/jurisdiction review for production sources remains external. docs/evidence/m16-research-restrictions.md. backlog:PRD-0253

  `PRD-0254`    P2         §265     `VERIFIED`   apps/web/app/capabilities/[slug]/page.tsx   tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-research-restrictions.md   Authentic published research capability tells the buyer website access is restricted and can be unavailable; installed paid buyer/Worker/browser path passed 2/2.

  `PRD-0255`    P2         §265     `DEFERRED_VERIFICATION`   packages/application/src/research-broker.ts   tests/research-broker.test.mjs   Robots/access/rate restrictions and no-bypass policy are implemented; concrete website terms, data-use, copyright and jurisdiction review requires an independent legal/product review of production sources. docs/evidence/m16-research-restrictions.md. backlog:PRD-0255

  `PRD-0256`    P2         §265     `VERIFIED`   packages/application/src/research-broker.ts,apps/worker/src/broker-sidecar.ts,runtime/openclaw/bridge.mjs   tests/research-broker.test.mjs,tests/docker-broker-sidecar-local-integration.mjs,docs/evidence/m16-research-restrictions.md   Public fetch/download respects pinned robots and access walls, denies before page request without alternate transport, and real offline Docker broker returns a sanitized limitation.

  `PRD-0257`    P2         §265     `VERIFIED`   packages/application/src/research-broker.ts   tests/research-broker.test.mjs   M16 real isolated Docker/OpenClaw test gets SOURCE_UNAVAILABLE for a 403 wall, fetches one approved alternate source and submits a truthful limitation; no retry storm. docs/evidence/m16-research-restrictions.md

  `SEC-0082`    P1         §266     `OPEN_IMPLEMENTATION`   packages/policy-engine/src/public-destination.ts,packages/application/src/research-broker.ts   tests/research-broker.test.mjs   partial M06 evidence; backlog:SEC-0082

  `SEC-0083`    P0         §266     `OPEN_IMPLEMENTATION`   packages/policy-engine/src/public-destination.ts,packages/application/src/research-broker.ts   tests/research-broker.test.mjs   partial M06 evidence; backlog:SEC-0083

  `SEC-0084`    P0         §266     `OPEN_IMPLEMENTATION`   packages/policy-engine/src/public-destination.ts,packages/application/src/research-broker.ts   tests/research-broker.test.mjs   partial M06 evidence; backlog:SEC-0084

  `PRD-0258`    P1         §267     `DEFERRED_VERIFICATION`   packages/persistence/src/research-usage.ts   tests/m06-postgres-integration.mjs   partial M06 evidence; backlog:PRD-0258

  `PRD-0259`    P2         §267     `DEFERRED_VERIFICATION`   packages/persistence/src/research-usage.ts   tests/m06-postgres-integration.mjs   partial M06 evidence; backlog:PRD-0259

  `SEC-0085`    P1         §268     `DEFERRED_VERIFICATION`   packages/infrastructure/http/src/pinned-http.ts,packages/policy-engine/src/public-destination.ts   tests/research-broker.test.mjs,tools/test-m06-public-fetch.mjs   partial M06 evidence; backlog:SEC-0085

  `SEC-0086`    P0         §268     `DEFERRED_VERIFICATION`   packages/infrastructure/http/src/pinned-http.ts,packages/policy-engine/src/public-destination.ts   tests/research-broker.test.mjs,tools/test-m06-public-fetch.mjs   partial M06 evidence; backlog:SEC-0086

  `SEC-0087`    P0         §268     `DEFERRED_VERIFICATION`   packages/infrastructure/http/src/pinned-http.ts,packages/policy-engine/src/public-destination.ts   tests/research-broker.test.mjs,tools/test-m06-public-fetch.mjs   partial M06 evidence; backlog:SEC-0087

  `PRD-0260`    P1         §269     `DEFERRED_VERIFICATION`   packages/infrastructure/contracts/src/research-ports.ts,packages/application/src/research-broker.ts   tests/architecture.test.mjs   partial M06 evidence; backlog:PRD-0260

  `PRD-0261`    P2         §269     `DEFERRED_VERIFICATION`   packages/infrastructure/contracts/src/research-ports.ts,packages/application/src/research-broker.ts   tests/architecture.test.mjs   partial M06 evidence; backlog:PRD-0261

  `PRD-0262`    P2         §269     `DEFERRED_VERIFICATION`   packages/infrastructure/contracts/src/research-ports.ts,packages/application/src/research-broker.ts   tests/architecture.test.mjs   partial M06 evidence; backlog:PRD-0262

  `PRD-0263`    P2         §269     `DEFERRED_VERIFICATION`   packages/infrastructure/contracts/src/research-ports.ts,packages/application/src/research-broker.ts   tests/architecture.test.mjs   partial M06 evidence; backlog:PRD-0263

  `PRD-0264`    P1         §270     `OPEN_IMPLEMENTATION`   packages/infrastructure/http/src/brave-search.ts   tests/research-broker.test.mjs   partial M06 evidence; backlog:PRD-0264

  `PRD-0265`    P2         §270     `OPEN_IMPLEMENTATION`   packages/infrastructure/http/src/brave-search.ts   tests/research-broker.test.mjs   partial M06 evidence; backlog:PRD-0265

  `PRD-0266`    P1         §271     `VERIFIED`   packages/application/src/research-broker.ts   tests/research-broker.test.mjs   M16 real Docker/OpenClaw consumes only normalized hostile HTML text after broker sanitization; unit probes cover limits and unsafe content, and isolated runtime has no personal browser. docs/evidence/m16-research-sanitization.md

  `PRD-0267`    P2         §271     `VERIFIED`   packages/application/src/research-broker.ts,apps/worker/src/broker-router.ts,apps/worker/src/execution-runtime.ts   tests/research-broker.test.mjs,tests/docker-broker-sidecar-local-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-research-sanitization.md   M16 hostile HTML script is stripped to bounded untrusted text before the reviewed tool reaches isolated OpenClaw; the paid path uses that same broker and cannot reach a personal browser/session. Full §271 remains open separately.

  `CAP-0065`    P1         §272     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-package.ts,packages/contracts/src/capability-version.ts,packages/domain/src/capability-version.ts,packages/policy-engine/src/permission-diff.ts   tests/capability-version.test.mjs,tests/permission-diff.test.mjs   partial M06 evidence; backlog:CAP-0065

  `CAP-0066`    P1         §272     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-package.ts,packages/contracts/src/capability-version.ts,packages/domain/src/capability-version.ts,packages/policy-engine/src/permission-diff.ts   tests/capability-version.test.mjs,tests/permission-diff.test.mjs   partial M06 evidence; backlog:CAP-0066

  `SEC-0088`    P1         §273     `OPEN_IMPLEMENTATION`   packages/policy-engine/src/public-destination.ts,packages/persistence/src/research-usage.ts   tests/research-broker.test.mjs,tests/m06-postgres-integration.mjs   partial M06 evidence; backlog:SEC-0088

  `SEC-0089`    P0         §273     `OPEN_IMPLEMENTATION`   packages/policy-engine/src/public-destination.ts,packages/persistence/src/research-usage.ts   tests/research-broker.test.mjs,tests/m06-postgres-integration.mjs   partial M06 evidence; backlog:SEC-0089

  `PRD-0268`    P1         §274     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,tools/test-m06-public-fetch.mjs   tests/research-broker.test.mjs,tools/test-m06-public-fetch.mjs   partial M06 evidence; backlog:PRD-0268

  `PRD-0269`    P2         §274     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,tools/test-m06-public-fetch.mjs   tests/research-broker.test.mjs,tools/test-m06-public-fetch.mjs   partial M06 evidence; backlog:PRD-0269

  `PRD-0270`    P1         §275     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts   tests/research-broker.test.mjs   partial M06 evidence; backlog:PRD-0270

  `PRD-0271`    P2         §275     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts   tests/research-broker.test.mjs   partial M06 evidence; backlog:PRD-0271

  `PRD-0272`    P2         §275     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/policy-engine/src/public-destination.ts   tests/research-broker.test.mjs   partial M06 evidence; backlog:PRD-0272

  `PRD-0273`    P1         §276     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/persistence/src/research-usage.ts   tests/research-broker.test.mjs,tests/m06-postgres-integration.mjs   partial M06 evidence; backlog:PRD-0273 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open. M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `PRD-0274`    P2         §276     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/persistence/src/research-usage.ts   tests/research-broker.test.mjs,tests/m06-postgres-integration.mjs   partial M06 evidence; backlog:PRD-0274 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open. M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `PRD-0275`    P2         §276     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/persistence/src/research-usage.ts   tests/research-broker.test.mjs,tests/m06-postgres-integration.mjs   partial M06 evidence; backlog:PRD-0275 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open. M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `PRD-0276`    P2         §276     `OPEN_IMPLEMENTATION`   packages/application/src/research-broker.ts,packages/persistence/src/research-usage.ts   tests/research-broker.test.mjs,tests/m06-postgres-integration.mjs   partial M06 evidence; backlog:PRD-0276 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open. M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `SEC-0090`    P1         §277     `VERIFIED`   packages/contracts/src/internet-policy.ts,apps/worker/src/execution-runtime.ts,packages/application/src/research-broker.ts,packages/application/src/declared-api-broker.ts,packages/sandbox-adapter/src/docker.ts tests/m16-installed-worker-e2e.mjs,tests/m06-postgres-integration.mjs,tests/docker-sandbox-local-integration.mjs Paid Docker/OpenClaw job uses only declared Cloud public research and seller-selected file; reviewed combined version additionally uses one fixed declared API. Offline jobs retain network none, and raw sandbox egress is denied.

  `SEC-0091`    P0         §277     `VERIFIED`   packages/contracts/src/internet-policy.ts,apps/worker/src/broker-router.ts,packages/application/src/research-broker.ts,packages/application/src/declared-api-broker.ts,packages/sandbox-adapter/src/docker.ts tests/m16-installed-worker-e2e.mjs,tests/m06-postgres-integration.mjs,tests/docker-sandbox-local-integration.mjs Policy admits only NO_NETWORK, brokered PUBLIC_WEB_RESEARCH or schema-bound DECLARED_API_ACCESS; actual sandbox has no arbitrary TCP/UDP or seller-network access.

  `PRD-0277`    P1         §278     `OPEN_IMPLEMENTATION`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 component evidence only; backlog:PRD-0277

  `PRD-0278`    P2         §278     `OPEN_IMPLEMENTATION`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 component evidence only; backlog:PRD-0278

  `PRD-0279`    P2         §278     `OPEN_IMPLEMENTATION`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 component evidence only; backlog:PRD-0279

  `PRD-0280`    P1         §279     `TODO`   ---   ---   OPEN later-owned implementation: M10 buyer billing and price UI plus M13 authenticated API; docs/milestones/M08.md

  `PRD-0281`    P2         §279     `TODO`   ---   ---   OPEN later-owned implementation: M10 buyer billing and price UI plus M13 authenticated API; docs/milestones/M08.md

  `PRD-0282`    P2         §279     `OPEN_IMPLEMENTATION`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 component evidence only; backlog:PRD-0282 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `PRD-0283`    P2         §279     `TODO`   ---   ---   OPEN later-owned implementation: M10 buyer billing and price UI plus M13 authenticated API; docs/milestones/M08.md

  `PRD-0284`    P1         §280     `TODO`   apps/web/app/seller/operations-dashboard.tsx   tests/browser-m12/seller-operations.spec.ts   M12 dashboard price split exists; M14 prepublication price selection and economics UI remains OPEN.

  `PRD-0285`    P2         §280     `TODO`   apps/web/app/seller/operations-dashboard.tsx   tests/browser-m12/seller-operations.spec.ts   M12 dashboard price split exists; M14 prepublication economics UI remains OPEN.

  `PRD-0286`    P2         §280     `TODO`   apps/web/app/seller/operations-dashboard.tsx   tests/browser-m12/seller-operations.spec.ts   M12 dashboard calculates the published split; M14 prepublication tier choice remains OPEN.

  `PRD-0287`    P1         §281     `VERIFIED`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PRD-0288`    P2         §281     `VERIFIED`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PRD-0289`    P2         §281     `VERIFIED`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0081`    P1         §282     `OPEN_IMPLEMENTATION`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 component evidence only; backlog:PAY-0081

  `PAY-0082`    P0         §282     `VERIFIED`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0083`    P0         §282     `VERIFIED`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PRD-0290`    P1         §283     `VERIFIED`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PRD-0291`    P2         §283     `VERIFIED`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PRD-0292`    P1         §284     `OPEN_IMPLEMENTATION`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 component evidence only; backlog:PRD-0292

  `PRD-0293`    P1         §285     `TODO`   ---   ---   M14 seller publishing price-tier UI remains OPEN.

  `PRD-0294`    P2         §285     `TODO`   ---   ---   M14 seller publishing price-tier UI remains OPEN.

  `PRD-0295`    P1         §286     `OPEN_IMPLEMENTATION`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 component evidence only; backlog:PRD-0295

  `PRD-0296`    P1         §287     `OPEN_IMPLEMENTATION`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 component evidence only; backlog:PRD-0296

  `PRD-0297`    P2         §287     `VERIFIED`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PRD-0298`    P2         §287     `OPEN_IMPLEMENTATION`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 component evidence only; backlog:PRD-0298

  `PRD-0299`    P2         §287     `TODO`   ---   ---   OPEN later-owned implementation: M23/M28 legal, tax, accounting and release decisions; docs/milestones/M08.md

  `PAY-0084`    P1         §288     `TODO`   ---   ---   OPEN later-owned implementation: M23/M28 legal, tax, accounting and release decisions; docs/milestones/M08.md

  `PAY-0085`    P0         §288     `VERIFIED`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0086`    P0         §288     `TODO`   ---   ---   OPEN later-owned implementation: M23/M28 legal, tax, accounting and release decisions; docs/milestones/M08.md

  `PAY-0087`    P0         §288     `VERIFIED`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0088`    P0         §288     `TODO`   ---   ---   OPEN later-owned implementation: M23/M28 legal, tax, accounting and release decisions; docs/milestones/M08.md

  `PAY-0089`    P1         §289     `VERIFIED`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0090`    P0         §289     `VERIFIED`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0091`    P0         §289     `VERIFIED`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0092`    P1         §290     `TODO`   ---   ---   OPEN later-owned implementation: M13/M14 capability repricing and discovery publication; docs/milestones/M08.md

  `PAY-0093`    P0         §290     `TODO`   ---   ---   OPEN later-owned implementation: M13/M14 capability repricing and discovery publication; docs/milestones/M08.md

  `PAY-0094`    P0         §290     `TODO`   ---   ---   OPEN later-owned implementation: M13/M14 capability repricing and discovery publication; docs/milestones/M08.md

  `PAY-0095`    P0         §290     `TODO`   ---   ---   OPEN later-owned implementation: M13/M14 capability repricing and discovery publication; docs/milestones/M08.md

  `PRD-0300`    P1         §291     `TODO`   ---   ---   OPEN later-owned implementation: M11 Marketplace Agent and orchestration; docs/milestones/M08.md

  `PRD-0301`    P2         §291     `TODO`   ---   ---   OPEN later-owned implementation: M11 Marketplace Agent and orchestration; docs/milestones/M08.md

  `PRD-0302`    P1         §292     `VERIFIED`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PRD-0303`    P2         §292     `VERIFIED`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0096`    P1         §293     `VERIFIED`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0097`    P0         §293     `VERIFIED`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PRD-0304`    P1         §294     `VERIFIED`   packages/persistence/src/finance.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m08-finance-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-seller-pricing.md   M16 real paid development-credit Worker/browser and ledger-backed seller pricing verified against immutable snapshot; Stripe-specific acceptance remains separate.

  `PRD-0305`    P2         §294     `VERIFIED`   apps/web/app/seller/operations-dashboard.tsx   tests/browser-m12/seller-operations.spec.ts   Gross buyer sales are labeled as settled buyer sales, separate from seller earnings.

  `PRD-0306`    P1         §295     `TODO`   ---   ---   OPEN later-owned implementation: M10 buyer billing and price UI plus M13 authenticated API; docs/milestones/M08.md

  `PRD-0307`    P2         §295     `TODO`   ---   ---   OPEN later-owned implementation: M10 buyer billing and price UI plus M13 authenticated API; docs/milestones/M08.md

  `PAY-0098`    P1         §296     `DEFERRED_VERIFICATION`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 component evidence only; backlog:PAY-0098

  `PAY-0099`    P0         §296     `VERIFIED`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PAY-0100`    P0         §296     `DEFERRED`   ---   ---   OPEN later-owned implementation: §296 future multi-currency and experiment operation; docs/milestones/M08.md

  `PAY-0101`    P0         §296     `VERIFIED`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PRD-0308`    P1         §297     `TODO`   ---   ---   OPEN later-owned implementation: M10/M14 product copy and full UI acceptance; docs/milestones/M08.md

  `PRD-0309`    P2         §297     `OPEN_IMPLEMENTATION`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 component evidence only; backlog:PRD-0309 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `PRD-0310`    P2         §297     `VERIFIED`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PRD-0311`    P2         §297     `TODO`   ---   ---   OPEN later-owned implementation: M10 buyer billing and price UI plus M13 authenticated API; docs/milestones/M08.md

  `PRD-0312`    P2         §297     `VERIFIED`   packages/persistence/src/price-tiers.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/finance.ts   tests/m08-finance-postgres-integration.mjs,tests/finance-policy.test.mjs   M08 Core/PostgreSQL boundary verified; docs/milestones/M08.md

  `PRD-0313`    P1         §298     `TODO`   ---   ---   OPEN later-owned implementation: M10/M14 product copy and full UI acceptance; docs/milestones/M08.md

  `PRD-0314`    P2         §298     `TODO`   ---   ---   OPEN later-owned implementation: M10/M14 product copy and full UI acceptance; docs/milestones/M08.md

  `PRD-0315`    P2         §298     `TODO`   apps/web/app/seller/operations-dashboard.tsx   tests/browser-m12/seller-operations.spec.ts   M12 current published split is visible; M14 tier choice before publication remains OPEN.

  `SEC-0092`    P1         §299     `VERIFIED`   packages/contracts/src/permission-policy.ts,packages/policy-engine/src/public-manifest.ts,apps/worker/src/import-package.ts,apps/worker/src/execution-runtime.ts,apps/web/app/capabilities/[slug]/page.tsx   tests/m06-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,tests/import-package.test.mjs,docs/evidence/m16-research-private-resources.md   One reviewed version exercises research, read-only company database, selected file and fixed read-only API through real Docker/OpenClaw, then authentic seller publication and buyer detail show the normalized powers without internal paths or credentials. The separate installed paid path proves Cloud research/private-read and selected-file enforcement.

  `SEC-0093`    P0         §299     `VERIFIED`   packages/contracts/src/permission-policy.ts,packages/policy-engine/src/public-manifest.ts,apps/web/app/capabilities/[slug]/page.tsx   tests/permission-policy.test.mjs,tests/m06-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-permission-manifest-review.md   Every published buyer detail uses the immutable Core public manifest; authentic seller/buyer browsers compare all 11 visible categories and states with the Worker-reviewed version.

  `SEC-0094`    P0         §299     `VERIFIED`   packages/contracts/src/permission-policy.ts,packages/policy-engine/src/public-manifest.ts,apps/web/app/capabilities/[slug]/page.tsx   tests/permission-policy.test.mjs,tests/m06-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-permission-manifest-review.md   Dedicated read-only database broker executes through real Docker/OpenClaw; authenticated seller and public buyer pages display Seller Database — Read Only from the exact reviewed manifest.

  `SEC-0095`    P0         §299     `VERIFIED`   apps/worker/src/selected-local-file.ts,apps/worker/src/import-package.ts,apps/web/app/capabilities/[slug]/page.tsx   tests/import-package.test.mjs,tests/selected-local-file.test.mjs,tests/docker-openclaw-selected-file-local-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-research-private-resources.md   Seller-approved selected company file reaches only the read-only Worker broker in the installed paid Docker/OpenClaw path. The exact published buyer page shows SELECTED_ONLY, while the host path and unselected bytes remain absent.

  `SEC-0096`    P0         §299     `VERIFIED`   packages/contracts/src/permission-policy.ts,packages/policy-engine/src/public-manifest.ts,apps/web/app/capabilities/[slug]/page.tsx   tests/permission-policy.test.mjs,tests/m06-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-permission-manifest-review.md   The buyer detail presents a stable plain-language trust table, visually reviewed at desktop/mobile and compared with the signed version before paid execution.

  `SEC-0097`    P0         §299     `VERIFIED`   packages/contracts/src/permission-policy.ts,packages/policy-engine/src/public-manifest.ts,apps/web/app/capabilities/[slug]/page.tsx   tests/permission-policy.test.mjs,tests/m06-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-permission-manifest-review.md   Buyer can inspect all allowed powers, including absent browser/network/shell and read-only DB, on the actual capability detail before purchase.

  `SEC-0098`    P1         §300     `VERIFIED`   packages/contracts/src/permission-policy.ts,packages/policy-engine/src/public-manifest.ts,apps/web/app/capabilities/[slug]/page.tsx   tests/permission-policy.test.mjs,tests/m06-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-permission-manifest-review.md   Stable 11-category schema requires each category once, derives safe states from internal policy, and excludes private resource IDs/credentials; public HTML redaction and browser labels pass.

  `CAP-0067`    P1         §301     `VERIFIED`   apps/worker/src/import-package.ts,apps/worker/src/execution-runtime.ts,packages/policy-engine/src/public-manifest.ts,apps/web/app/capabilities/[slug]/page.tsx   tests/m06-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-research-private-resources.md   One seller-reviewed version combines public research, read-only company database and a selected dataset in real Docker/OpenClaw; authenticated seller publication and the buyer page display the exact §301 trust states, with browser/shell/external actions denied. The separate installed paid path proves lease-bound cloud research and selected-file routing.

  `CAP-0068`    P1         §301     `VERIFIED`   apps/worker/src/selected-local-file.ts,packages/policy-engine/src/public-manifest.ts,apps/web/app/capabilities/[slug]/page.tsx   tests/m06-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,tests/docker-openclaw-selected-file-local-integration.mjs,docs/evidence/m16-research-private-resources.md   The reviewed company dataset is the only seller file readable through the opaque broker, and the same published version displays SELECTED_ONLY to buyers without exposing its host path or bytes.

  `CAP-0069`    P1         §301     `VERIFIED`   packages/contracts/src/permission-policy.ts,packages/policy-engine/src/public-manifest.ts,apps/web/app/capabilities/[slug]/page.tsx   tests/permission-policy.test.mjs,tests/m06-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-permission-manifest-review.md   The buyer detail explicitly states no messages, publication, purchases or remote-account changes when the immutable EXTERNAL_SIDE_EFFECTS state is NOT_USED; broker/sandbox denial is tested.

  `CAP-0070`    P1         §301     `VERIFIED`   packages/contracts/src/permission-policy.ts,packages/policy-engine/src/public-manifest.ts,apps/web/app/capabilities/[slug]/page.tsx   tests/permission-policy.test.mjs,tests/m06-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-permission-manifest-review.md   The complete buyer-visible manifest appears on the real capability detail under Privacy & access, with keyboard-operable disclosure and responsive browser evidence.

  `SEC-0099`    P1         §302     `VERIFIED`   packages/domain/src/capability-version.ts,packages/persistence/src/seller-publication.ts,packages/policy-engine/src/public-manifest.ts tests/seller-publication-contract.test.mjs,tests/m06-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs Immutable published version derives the buyer-safe manifest from the reviewed local policy; real broker execution and buyer rendering match the snapshot.

  `SEC-0100`    P0         §302     `VERIFIED`   packages/domain/src/capability-version.ts,packages/persistence/src/seller-publication.ts,packages/policy-engine/src/public-manifest.ts tests/seller-publication-contract.test.mjs,tests/m06-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs Manifest is generated from the reviewed immutable policy and tested against real selected-resource/research execution and buyer page.

  `SEC-0101`    P0         §302     `VERIFIED`   packages/contracts/src/seller-publication.ts,packages/domain/src/capability-version.ts tests/seller-publication-contract.test.mjs Seller approval rejects a supplied publicPermissionManifest; factual permission fields are platform-generated.

  `SEC-0102`    P1         §303     `OPEN_IMPLEMENTATION`   packages/policy-engine/src/public-manifest.ts,packages/policy-engine/src/permission-diff.ts tests/permission-policy.test.mjs,tests/permission-diff.test.mjs exact-reference diff baseline only;  backlog:SEC-0102 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `SEC-0103`    P0         §303     `OPEN_IMPLEMENTATION`   packages/policy-engine/src/permission-diff.ts tests/permission-diff.test.mjs exact-reference diff baseline only; seller review/publish gate absent;  backlog:SEC-0103

  `SEC-0104`    P0         §303     `OPEN_IMPLEMENTATION`   packages/policy-engine/src/permission-diff.ts tests/permission-diff.test.mjs exact-reference diff baseline only; version publish gate absent;  backlog:SEC-0104

  `SEC-0105`    P1    §304    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-planner.ts,packages/domain/src/agent-plan.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 closes prior deferred gate with current published supply, deterministic constraints and test evidence; docs/milestones/M11.md.

  `SEC-0106`    P0    §304    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-planner.ts,packages/domain/src/agent-plan.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 closes prior deferred gate with current published supply, deterministic constraints and test evidence; docs/milestones/M11.md.

  `CAP-0071`    P1         §305     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-version.ts tests/capability-version.test.mjs baseline only;  backlog:CAP-0071

  `CAP-0072`    P1         §305     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-version.ts,packages/persistence/migrations/0001_foundation.sql tests/capability-version.test.mjs,tests/sql/m01_foundation.sql baseline only;  backlog:CAP-0072

  `CAP-0073`    P1         §306     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-version.ts,packages/contracts/src/capability-package.ts tests/capability-version.test.mjs local package/hash baseline only;  backlog:CAP-0073 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `CAP-0074`    P1         §306     `OPEN_IMPLEMENTATION`   packages/domain/src/capability-version.ts,packages/contracts/src/capability-package.ts tests/capability-version.test.mjs local package/hash baseline only;  backlog:CAP-0074 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `CAP-0075`    P1         §306     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-version.ts tests/capability-version.test.mjs baseline only;  backlog:CAP-0075

  `CAP-0076`    P1         §307     `OPEN_IMPLEMENTATION`   packages/persistence/migrations/0001_foundation.sql tests/sql/m01_foundation.sql baseline only;  backlog:CAP-0076

  `CAP-0077`    P1         §307     `OPEN_IMPLEMENTATION`   packages/persistence/migrations/0001_foundation.sql tests/sql/m01_foundation.sql baseline only;  backlog:CAP-0077

  `CAP-0078`    P1         §307     `OPEN_IMPLEMENTATION`   ---              ---        --- backlog:CAP-0078 M10 component: apps/web/src/marketplace,apps/web/app/discover,apps/web/app/buyer; tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts; full gate OPEN.

  `CAP-0079`    P1         §308     `DEFERRED_VERIFICATION`   packages/contracts/src/capability-version.ts,packages/domain/src/capability-version.ts tests/capability-version.test.mjs baseline only;  backlog:CAP-0079

  `CAP-0080`    P1         §308     `DEFERRED_VERIFICATION`   packages/domain/src/capability-version.ts tests/capability-version.test.mjs baseline only;  backlog:CAP-0080

  `CAP-0081`    P1         §309     `DEFERRED_VERIFICATION`   packages/persistence/src/seller-publication.ts,packages/persistence/migrations/0027_capability_rollback.sql   tests/m14-publication-postgres-integration.mjs   M14 rollback transaction and fresh readiness/payout denial tested; real Worker rollback and in-flight paid version pinning still unverified. backlog:CAP-0081

  `CAP-0082`    P1         §309     `DEFERRED_VERIFICATION`   packages/persistence/src/seller-publication.ts,packages/persistence/migrations/0027_capability_rollback.sql   tests/m14-publication-postgres-integration.mjs   M14 rollback transaction and fresh readiness/payout denial tested; real Worker rollback and in-flight paid version pinning still unverified. backlog:CAP-0082

  `CAP-0083`    P1         §310     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-visibility.ts,packages/domain/src/capability-visibility.ts,packages/persistence/migrations/0008_capability_visibility.sql   tests/capability-visibility.test.mjs,tests/sql/m03_visibility.sql   Visibility/version state and private grants constrained; authenticated marketplace/API/Worker E2E pending baseline/open; backlog:CAP-0083

  `SEC-0107`    P1         §311     `OPEN_IMPLEMENTATION`   apps/web/app/seller/seller-version-control.tsx   tests/browser-m12/seller-operations.spec.ts   M14 seller version history and price/permission/I-O/dependency summaries rendered; prepublication permission-expansion acknowledgement and real tested package remain open. backlog:SEC-0107

  `CAP-0084`    P1         §312     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-visibility.ts,packages/domain/src/capability-visibility.ts,packages/persistence/migrations/0008_capability_visibility.sql   tests/capability-visibility.test.mjs,tests/sql/m03_visibility.sql   Visibility/version state and private grants constrained; authenticated marketplace/API/Worker E2E pending baseline/open; backlog:CAP-0084 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN. M14 component: packages/persistence/src/seller-publication.ts,packages/persistence/migrations/0028_seller_visibility.sql,apps/web/app/seller/seller-visibility-control.tsx; tests/m14-publication-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts; full paid Worker/two-account gate still OPEN.

  `CAP-0085`    P1         §312     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-visibility.ts,packages/domain/src/capability-visibility.ts,packages/persistence/migrations/0008_capability_visibility.sql   tests/capability-visibility.test.mjs,tests/sql/m03_visibility.sql   Visibility/version state and private grants constrained; authenticated marketplace/API/Worker E2E pending baseline/open; backlog:CAP-0085 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN. M14 component: packages/persistence/src/seller-publication.ts,packages/persistence/migrations/0028_seller_visibility.sql,apps/web/app/seller/seller-visibility-control.tsx; tests/m14-publication-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts; full paid Worker/two-account gate still OPEN.

  `TST-0020`    P1         §313     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-visibility.ts,packages/domain/src/capability-visibility.ts,packages/persistence/migrations/0008_capability_visibility.sql   tests/capability-visibility.test.mjs,tests/sql/m03_visibility.sql   Visibility/version state and private grants constrained; authenticated marketplace/API/Worker E2E pending baseline/open; backlog:TST-0020 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `PRD-0316`    P1         §314     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-visibility.ts,packages/domain/src/capability-visibility.ts,packages/persistence/migrations/0008_capability_visibility.sql   tests/capability-visibility.test.mjs,tests/sql/m03_visibility.sql   Visibility/version state and private grants constrained; authenticated marketplace/API/Worker E2E pending baseline/open; backlog:PRD-0316 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN. M14 component: packages/persistence/src/seller-publication.ts,packages/persistence/migrations/0028_seller_visibility.sql,apps/web/app/seller/seller-visibility-control.tsx; tests/m14-publication-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts; full paid Worker/two-account gate still OPEN.

  `PRD-0317`    P2         §314     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-visibility.ts,packages/domain/src/capability-visibility.ts,packages/persistence/migrations/0008_capability_visibility.sql   tests/capability-visibility.test.mjs,tests/sql/m03_visibility.sql   Visibility/version state and private grants constrained; authenticated marketplace/API/Worker E2E pending baseline/open; backlog:PRD-0317 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN. M14 component: packages/persistence/src/seller-publication.ts,packages/persistence/migrations/0028_seller_visibility.sql,apps/web/app/seller/seller-visibility-control.tsx; tests/m14-publication-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts; full paid Worker/two-account gate still OPEN.

  `PRD-0318`    P1         §315     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-visibility.ts,packages/domain/src/capability-visibility.ts,packages/persistence/migrations/0008_capability_visibility.sql   tests/capability-visibility.test.mjs,tests/sql/m03_visibility.sql   Visibility/version state and private grants constrained; authenticated marketplace/API/Worker E2E pending baseline/open; backlog:PRD-0318 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN. M14 component: packages/persistence/src/seller-publication.ts,packages/persistence/migrations/0028_seller_visibility.sql,apps/web/app/seller/seller-visibility-control.tsx; tests/m14-publication-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts; full paid Worker/two-account gate still OPEN.

  `PRD-0319`    P2         §315     `OPEN_IMPLEMENTATION`   packages/contracts/src/capability-visibility.ts,packages/domain/src/capability-visibility.ts,packages/persistence/migrations/0008_capability_visibility.sql   tests/capability-visibility.test.mjs,tests/sql/m03_visibility.sql   Visibility/version state and private grants constrained; authenticated marketplace/API/Worker E2E pending baseline/open; backlog:PRD-0319 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN. M14 component: packages/persistence/src/seller-publication.ts,packages/persistence/migrations/0028_seller_visibility.sql,apps/web/app/seller/seller-visibility-control.tsx; tests/m14-publication-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts; full paid Worker/two-account gate still OPEN.

  `CAP-0086`    P1         §316     `DEFERRED_VERIFICATION`   packages/contracts/src/capability-visibility.ts,packages/domain/src/capability-visibility.ts,packages/persistence/migrations/0008_capability_visibility.sql   tests/capability-visibility.test.mjs,tests/sql/m03_visibility.sql   Visibility/version state and private grants constrained; authenticated marketplace/API/Worker E2E pending baseline/open; backlog:CAP-0086 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open. M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN. M14 component: packages/persistence/src/seller-publication.ts,packages/persistence/migrations/0028_seller_visibility.sql,apps/web/app/seller/seller-visibility-control.tsx; tests/m14-publication-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts; real PUBLIC eligibility with a ready Stripe test Connect account and reviewed installed Worker still unverified; see backlog:CAP-0086.

  `JOB-0066`    P1         §317     `VERIFIED`   packages/persistence/src/seller-publication.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/job-execution.ts   tests/m14-publication-postgres-integration.mjs,tests/m10-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-visibility-history.md   M16 authenticated seller transitions, real paid installed Worker in-flight transition, two-account access and durable job/review preservation passed; Stripe/provider release gates remain separate.

  `JOB-0067`    P1         §317     `VERIFIED`   packages/persistence/src/seller-publication.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/job-execution.ts   tests/m14-publication-postgres-integration.mjs,tests/m10-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-visibility-history.md   M16 authenticated seller transitions, real paid installed Worker in-flight transition, two-account access and durable job/review preservation passed; Stripe/provider release gates remain separate.

  `PRD-0320`    P1         §318     `VERIFIED`   apps/worker/src/capability-package-store.ts,apps/worker/src/import-review-runner.ts,packages/persistence/src/seller-publication.ts,apps/web/app/seller/seller-publication.tsx,apps/web/app/seller/seller-visibility-control.tsx   tests/m16-core-worker-integration.mjs,tests/m16-installed-worker-e2e.mjs,tests/m10-postgres-integration.mjs,docs/evidence/m16-private-version-file-e2e.md   Seller A publishes v3 PRIVATE, grants verified buyer B through authenticated Web, B uploads a file and buys an actual Docker/OpenClaw job, then reopens/downloads the private result; account C is denied.

  `PRD-0321`    P2         §318     `VERIFIED`   apps/worker/src/capability-package-store.ts,apps/worker/src/import-review-runner.ts,packages/persistence/src/seller-publication.ts,apps/web/app/seller/seller-publication.tsx,apps/web/app/seller/seller-visibility-control.tsx   tests/m16-core-worker-integration.mjs,tests/m16-installed-worker-e2e.mjs,tests/m10-postgres-integration.mjs,docs/evidence/m16-private-version-file-e2e.md   A real PRIVATE capability is granted in the seller Web UI and the distinct buyer sees the authentic buyer page before purchasing through the shared Core payment/Worker path.

  `PRD-0322`    P2         §318     `VERIFIED`   apps/worker/src/capability-package-store.ts,apps/worker/src/import-review-runner.ts,packages/persistence/src/seller-publication.ts,apps/web/app/seller/seller-publication.tsx,apps/web/app/seller/seller-visibility-control.tsx   tests/m16-core-worker-integration.mjs,tests/m16-installed-worker-e2e.mjs,tests/m10-postgres-integration.mjs,docs/evidence/m16-private-version-file-e2e.md   The development-credit test mode is explicitly non-production and still reserves/settles through the authoritative ledger; no production free-job bypass exists.

  `API-0008`    P1         §319      `VERIFIED`   packages/persistence/src/buyer-api-keys.ts,apps/web/app/account/buyer-integrations.tsx   tests/m13-postgres-integration.mjs,tests/browser-m13/buyer-integrations.spec.ts   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `API-0009`    P1         §319      `VERIFIED`   packages/persistence/src/buyer-api-keys.ts,apps/web/app/account/buyer-integrations.tsx   tests/m13-postgres-integration.mjs,tests/browser-m13/buyer-integrations.spec.ts   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `API-0010`    P1         §319      `VERIFIED`   packages/persistence/src/buyer-api-keys.ts,apps/web/app/account/buyer-integrations.tsx   tests/m13-postgres-integration.mjs,tests/browser-m13/buyer-integrations.spec.ts   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `API-0011`    P1         §319      `VERIFIED`   packages/persistence/src/buyer-api-keys.ts,apps/web/app/account/buyer-integrations.tsx   tests/m13-postgres-integration.mjs,tests/browser-m13/buyer-integrations.spec.ts   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `API-0012`    P1         §320      `VERIFIED`   packages/persistence/src/buyer-api-keys.ts,apps/web/app/account/buyer-integrations.tsx   tests/m13-postgres-integration.mjs,tests/browser-m13/buyer-integrations.spec.ts   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `API-0013`    P1         §320      `VERIFIED`   packages/persistence/src/buyer-api-keys.ts,apps/web/app/account/buyer-integrations.tsx   tests/m13-postgres-integration.mjs,tests/browser-m13/buyer-integrations.spec.ts   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `API-0014`    P1         §320      `VERIFIED`   packages/persistence/src/buyer-api-keys.ts,apps/web/app/account/buyer-integrations.tsx   tests/m13-postgres-integration.mjs,tests/browser-m13/buyer-integrations.spec.ts   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `API-0015`    P1         §321      `VERIFIED`   packages/persistence/src/buyer-api-keys.ts,apps/web/app/account/buyer-integrations.tsx   tests/m13-postgres-integration.mjs,tests/browser-m13/buyer-integrations.spec.ts   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `API-0016`    P1         §321      `VERIFIED`   packages/persistence/src/buyer-api-keys.ts,apps/web/app/account/buyer-integrations.tsx   tests/m13-postgres-integration.mjs,tests/browser-m13/buyer-integrations.spec.ts   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `IO-0136`    P1         §322      `VERIFIED`   apps/web/src/buyer-api/handler.ts,packages/persistence/src/buyer-api-keys.ts,packages/persistence/src/marketplace-buyer.ts   tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `IO-0137`    P1         §322      `VERIFIED`   apps/web/src/buyer-api/handler.ts,packages/persistence/src/buyer-api-keys.ts,packages/persistence/src/marketplace-buyer.ts   tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `CAP-0087`    P1         §323      `VERIFIED`   apps/web/src/buyer-api/handler.ts,packages/persistence/src/buyer-api-keys.ts,packages/persistence/src/marketplace-buyer.ts   tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `PAY-0102`    P1         §324      `VERIFIED`   apps/web/src/buyer-api/handler.ts,packages/persistence/src/buyer-api-keys.ts,packages/persistence/src/marketplace-buyer.ts   tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `PAY-0103`    P0         §324      `VERIFIED`   apps/web/src/buyer-api/handler.ts,packages/persistence/src/buyer-api-keys.ts,packages/persistence/src/marketplace-buyer.ts   tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `PAY-0104`    P0         §324      `VERIFIED`   apps/web/src/buyer-api/handler.ts,packages/persistence/src/buyer-api-keys.ts,packages/persistence/src/marketplace-buyer.ts   tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `PAY-0105`    P0         §324      `VERIFIED`   apps/web/src/buyer-api/handler.ts,packages/persistence/src/buyer-api-keys.ts,packages/persistence/src/marketplace-buyer.ts   tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `API-0017`    P1         §325      `VERIFIED`   apps/web/src/buyer-api/handler.ts,packages/persistence/src/buyer-api-keys.ts,packages/persistence/src/marketplace-buyer.ts   tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `API-0018`    P1         §325      `VERIFIED`   apps/web/src/buyer-api/handler.ts,packages/persistence/src/buyer-api-keys.ts,packages/persistence/src/marketplace-buyer.ts   tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `API-0019`    P1         §325      `VERIFIED`   apps/web/src/buyer-api/handler.ts,packages/persistence/src/buyer-api-keys.ts,packages/persistence/src/marketplace-buyer.ts   tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `API-0020`    P1         §326      `VERIFIED`   apps/web/src/buyer-api/handler.ts,packages/persistence/src/buyer-api-keys.ts,packages/persistence/src/marketplace-buyer.ts   tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `API-0021`    P1         §326      `VERIFIED`   apps/web/src/buyer-api/handler.ts,packages/persistence/src/buyer-api-keys.ts,packages/persistence/src/marketplace-buyer.ts   tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `PRD-0323`    P1         §327      `VERIFIED`   packages/persistence/src/buyer-webhooks.ts,packages/persistence/migrations/0023_buyer_api_webhooks.sql   tests/m13-postgres-integration.mjs,tests/browser-m13/buyer-integrations.spec.ts   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `JOB-0068`    P1         §328      `VERIFIED`   packages/persistence/src/buyer-webhooks.ts,packages/persistence/migrations/0023_buyer_api_webhooks.sql   tests/m13-postgres-integration.mjs,tests/browser-m13/buyer-integrations.spec.ts   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `JOB-0069`    P1         §328      `VERIFIED`   packages/persistence/src/buyer-webhooks.ts,packages/persistence/migrations/0023_buyer_api_webhooks.sql   tests/m13-postgres-integration.mjs,tests/browser-m13/buyer-integrations.spec.ts   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `API-0022`    P1         §329      `VERIFIED`   packages/persistence/src/buyer-webhooks.ts,packages/persistence/migrations/0023_buyer_api_webhooks.sql   tests/m13-postgres-integration.mjs,tests/browser-m13/buyer-integrations.spec.ts   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `JOB-0070`    P1         §330      `VERIFIED`   packages/persistence/src/buyer-webhooks.ts,packages/persistence/migrations/0023_buyer_api_webhooks.sql   tests/m13-postgres-integration.mjs,tests/browser-m13/buyer-integrations.spec.ts   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `JOB-0071`    P1         §330      `VERIFIED`   packages/persistence/src/buyer-webhooks.ts,packages/persistence/migrations/0023_buyer_api_webhooks.sql   tests/m13-postgres-integration.mjs,tests/browser-m13/buyer-integrations.spec.ts   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `PRD-0324`    P1         §331      `VERIFIED`   packages/application/src/webhook-policy.ts,packages/persistence/src/buyer-webhooks.ts   tests/m13-webhook-policy.test.mjs,tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `PRD-0325`    P2         §331      `VERIFIED`   packages/application/src/webhook-policy.ts,packages/persistence/src/buyer-webhooks.ts   tests/m13-webhook-policy.test.mjs,tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `PRD-0326`    P1         §332      `VERIFIED`   packages/application/src/webhook-policy.ts,packages/persistence/src/buyer-webhooks.ts   tests/m13-webhook-policy.test.mjs,tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `PRD-0327`    P2         §332      `VERIFIED`   packages/application/src/webhook-policy.ts,packages/persistence/src/buyer-webhooks.ts   tests/m13-webhook-policy.test.mjs,tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `PRD-0328`    P2         §332      `VERIFIED`   packages/application/src/webhook-policy.ts,packages/persistence/src/buyer-webhooks.ts   tests/m13-webhook-policy.test.mjs,tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `AVL-0003`    P1         §333      `VERIFIED`   packages/application/src/webhook-policy.ts,packages/persistence/src/buyer-webhooks.ts   tests/m13-webhook-policy.test.mjs,tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `API-0023`    P1         §334      `VERIFIED`   packages/application/src/webhook-policy.ts,packages/infrastructure/http/src/pinned-webhook-post.ts,packages/persistence/src/buyer-webhooks.ts   tests/m13-webhook-policy.test.mjs,tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `API-0024`    P1         §334      `VERIFIED`   packages/application/src/webhook-policy.ts,packages/infrastructure/http/src/pinned-webhook-post.ts,packages/persistence/src/buyer-webhooks.ts   tests/m13-webhook-policy.test.mjs,tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `API-0025`    P1         §334      `VERIFIED`   packages/application/src/webhook-policy.ts,packages/infrastructure/http/src/pinned-webhook-post.ts,packages/persistence/src/buyer-webhooks.ts   tests/m13-webhook-policy.test.mjs,tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `API-0026`    P1         §335      `VERIFIED`   apps/web/app/account/buyer-integrations.tsx,packages/persistence/src/buyer-webhooks.ts   tests/browser-m13/buyer-integrations.spec.ts,tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `API-0027`    P1         §335      `VERIFIED`   apps/web/app/account/buyer-integrations.tsx,packages/persistence/src/buyer-webhooks.ts   tests/browser-m13/buyer-integrations.spec.ts,tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `JOB-0072`    P1         §336     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:JOB-0072 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0073`    P1         §336     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:JOB-0073 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `AVL-0004`    P1         §337     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:AVL-0004 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open. M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `AVL-0005`    P1         §337     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:AVL-0005 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open. M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `JOB-0074`    P1         §338     `VERIFIED`   packages/persistence/src/availability.ts,apps/worker/src/runtime-readiness.ts,apps/worker/src/availability-reporter.ts,apps/worker/src/job-admission.ts   tests/m09-postgres-integration.mjs,tests/m12-postgres-integration.mjs,tests/worker-runtime-readiness.test.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-online-inference.md   Original ONLINE predicate is the conjunction of published/visible version, seller control, Worker, dependency/inference/security readiness and available capacity/queue; each blocking layer has executable denial evidence.

  `JOB-0075`    P1         §338     `VERIFIED`   apps/worker/src/runtime-readiness.ts,apps/worker/src/resource-ports.ts,apps/worker/src/availability-reporter.ts,packages/persistence/src/availability.ts   tests/selected-local-file.test.mjs,tests/worker-runtime-readiness.test.mjs,tests/m09-postgres-integration.mjs,tests/docker-sandbox-local-integration.mjs,docs/evidence/m16-online-inference.md   Reviewed runtime, selected resources and signed per-version dependency state must be healthy for ONLINE; changed bindings or missing pinned sandbox fail closed.

  `JOB-0076`    P1         §338     `VERIFIED`   apps/worker/src/runtime-readiness.ts,apps/worker/src/availability-reporter.ts,packages/persistence/src/availability.ts   tests/m16-installed-worker-e2e.mjs,tests/docker-local-inference-local-integration.mjs,docs/evidence/m16-online-inference.md   M16 installed paid Worker detects a stopped seller local model, removes READY, and prevents a new execution until the model health recovers.

  `JOB-0077`    P1         §339     `VERIFIED`   apps/worker/src/runtime-readiness.ts,apps/worker/src/availability-reporter.ts,packages/persistence/src/availability.ts,apps/web/app/capabilities   tests/worker-runtime-readiness.test.mjs,tests/worker-admission.test.mjs,tests/m09-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-busy-capacity.md   M16 installed paid Docker/OpenClaw Worker showed BUSY in buyer browser; bounded queued paid job did not execute in occupied slot and cancellation released reservation; PostgreSQL denied queue-full purchase.

  `JOB-0078`    P1         §339     `VERIFIED`   packages/persistence/src/availability.ts,apps/web/app/capabilities   tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-busy-capacity.md   M16 buyer browser showed actual BUSY state without a fabricated estimated wait while a real paid Docker/OpenClaw job held full capacity.

  `JOB-0079`    P1         §339      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts,packages/persistence/src/job-execution.ts   tests/m09-postgres-integration.mjs   M09 real PostgreSQL two-buyer slot race, heartbeat TTL, deterministic order or release; docs/milestones/M09.md

  `AVL-0006`    P1         §340     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:AVL-0006 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `AVL-0007`    P1         §340     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:AVL-0007 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `AVL-0008`    P1         §340      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts,packages/persistence/src/job-execution.ts   tests/m09-postgres-integration.mjs   M09 real PostgreSQL two-buyer slot race, heartbeat TTL, deterministic order or release; docs/milestones/M09.md

  `AVL-0009`    P1         §340     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:AVL-0009 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `JOB-0080`    P1         §341     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:JOB-0080

  `JOB-0081`    P1         §341     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:JOB-0081

  `JOB-0082`    P1         §342     `VERIFIED`   packages/persistence/src/job-execution.ts,apps/worker/src/job-control.ts,apps/worker/src/execution-supervisor.ts,apps/worker/src/broker-sidecar.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m16-installed-worker-e2e.mjs,tests/m12-postgres-integration.mjs,tests/worker-job-control.test.mjs,tests/browser-m12/seller-operations.spec.ts,docs/evidence/m16-capacity-and-pause-closure.md   M16 authentic seller Web paid pause/resume proves Core request, Worker Docker acknowledgement, paused provider barrier, truthful UI and one settlement; owner, replay, capability/global pause and offline CLI have separate regressions.

  `PRD-0329`    P1         §343     `VERIFIED`   packages/persistence/src/availability.ts,apps/worker/src/job-admission.ts   tests/m09-postgres-integration.mjs,tests/m13-postgres-integration.mjs,tests/m11-agent.test.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-capacity-and-pause-closure.md   M16 PostgreSQL tests prove min(published,seller,Worker) and exact final-slot denial; paid API race, Agent contract and installed BUSY Worker exercise other entry points.

  `PRD-0330`    P2         §343     `VERIFIED`   packages/contracts/src/marketplace-agent.ts,packages/persistence/src/availability.ts,apps/worker/src/job-admission.ts,runtime/openclaw/bridge.mjs   tests/m11-agent.test.mjs,tests/m09-postgres-integration.mjs,tests/docker-broker-sidecar-local-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-paid-schedule-window.md   Strict Agent/buyer contracts have no seller capacity controls; hostile paid buyer prompt leaves seller concurrency unchanged and real Worker enforces its single slot.

  `JOB-0083`    P1         §344     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:JOB-0083 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0084`    P1         §344      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts,packages/persistence/src/job-execution.ts   tests/m09-postgres-integration.mjs   M09 real PostgreSQL two-buyer slot race, heartbeat TTL, deterministic order or release; docs/milestones/M09.md

  `PAY-0106`    P1         §345      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts,packages/persistence/src/job-execution.ts   tests/m09-postgres-integration.mjs   M09 real PostgreSQL two-buyer slot race, heartbeat TTL, deterministic order or release; docs/milestones/M09.md

  `PAY-0107`    P0         §345      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts,packages/persistence/src/job-execution.ts   tests/m09-postgres-integration.mjs   M09 real PostgreSQL two-buyer slot race, heartbeat TTL, deterministic order or release; docs/milestones/M09.md

  `PAY-0108`    P0         §345      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts,packages/persistence/src/job-execution.ts   tests/m09-postgres-integration.mjs   M09 real PostgreSQL two-buyer slot race, heartbeat TTL, deterministic order or release; docs/milestones/M09.md

  `WRK-0099`    P1         §346     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:WRK-0099

  `WRK-0100`    P1         §346     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:WRK-0100

  `AVL-0010`    P1         §347     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:AVL-0010

  `AVL-0011`    P1         §347     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:AVL-0011

  `AVL-0012`    P1         §347     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:AVL-0012

  `AVL-0013`    P1         §347      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts,packages/persistence/src/job-execution.ts   tests/m09-postgres-integration.mjs   M09 real PostgreSQL two-buyer slot race, heartbeat TTL, deterministic order or release; docs/milestones/M09.md

  `AVL-0014`    P1         §347      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts,packages/persistence/src/job-execution.ts   tests/m09-postgres-integration.mjs   M09 real PostgreSQL two-buyer slot race, heartbeat TTL, deterministic order or release; docs/milestones/M09.md

  `AVL-0015`    P1         §348     `VERIFIED`   packages/persistence/src/availability.ts,packages/persistence/src/worker-heartbeat.ts,apps/web/app/seller/operations-dashboard.tsx   tests/availability-reporter.test.mjs,tests/m09-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts,docs/evidence/m16-capability-health-browser.md   M16 production Worker reporter emits two independent readiness states on one ONLINE device; PostgreSQL persists them, buyer availability and seller dashboard retain separate runtime and capacity/queue states; browser and live single-dependency outage regressions pass. docs/evidence/m16-capability-health-browser.md.

  `AVL-0016`    P1         §348     `VERIFIED`   apps/worker/src/availability-reporter.ts,packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/availability.ts   tests/availability-reporter.test.mjs,tests/m09-postgres-integration.mjs,docs/evidence/m16-capability-readiness.md   M16 production Worker reporter emits independent READY/NOT_READY on one ONLINE device; signed PostgreSQL projection preserves distinct buyer states. Full real multi-capability seller UI journey remains open under AVL-0015 and OBS-0011.

  `UI-0024`    P1         §349      `VERIFIED`   packages/persistence/src/availability.ts,apps/web/app/discover/marketplace-ui.tsx,apps/web/app/capabilities/[slug]/page.tsx   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   Browser checked ONLINE, BUSY, SCHEDULED_OFFLINE, OFFLINE, PAUSED and readiness blocked with text on card/detail

  `UI-0025`    P2         §349      `VERIFIED`   packages/persistence/src/availability.ts,apps/web/app/discover/marketplace-ui.tsx,apps/web/app/capabilities/[slug]/page.tsx   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   Browser checked ONLINE, BUSY, SCHEDULED_OFFLINE, OFFLINE, PAUSED and readiness blocked with text on card/detail

  `AVL-0017`    P1    §350    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-planner.ts,packages/domain/src/agent-plan.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 closes prior deferred gate with current published supply, deterministic constraints and test evidence; docs/milestones/M11.md.

  `AVL-0018`    P1    §350    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-planner.ts,packages/domain/src/agent-plan.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 closes prior deferred gate with current published supply, deterministic constraints and test evidence; docs/milestones/M11.md.

  `CAP-0088`    P1         §351      `VERIFIED`   apps/web/src/buyer-api/handler.ts,packages/persistence/src/availability.ts   tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `CAP-0089`    P1         §351      `VERIFIED`   apps/web/src/buyer-api/handler.ts,packages/persistence/src/availability.ts   tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `JOB-0085`    P1         §352     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:JOB-0085 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0086`    P1         §352     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:JOB-0086 M08 component: packages/persistence/src/finance.ts; tests/m08-finance-postgres-integration.mjs; full gate open.

  `JOB-0087`    P1         §353     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:JOB-0087

  `JOB-0088`    P1         §353      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts,packages/persistence/src/job-execution.ts   tests/m09-postgres-integration.mjs   M09 real PostgreSQL two-buyer slot race, heartbeat TTL, deterministic order or release; docs/milestones/M09.md

  `JOB-0089`    P1         §353      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts,packages/persistence/src/job-execution.ts   tests/m09-postgres-integration.mjs   M09 real PostgreSQL two-buyer slot race, heartbeat TTL, deterministic order or release; docs/milestones/M09.md

  `AVL-0019`    P1         §354      `VERIFIED`   packages/persistence/src/availability-metrics.ts,packages/persistence/migrations/0024_availability_metrics.sql,tools/kivro-scheduler.mjs,apps/web/app/seller/operations-dashboard.tsx   tests/m13-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M13 minute observations retain unknown gaps; seller-only metrics cover online/offline/busy time, accepted jobs, queue-full rejects, median waits/runtime and disconnect failures.

  `AVL-0020`    P1         §354      `VERIFIED`   packages/persistence/src/availability-metrics.ts,packages/persistence/src/marketplace-catalog.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m13-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M13 observations are seller-private and explicitly approximate; marketplace ranking does not use uptime or penalize laptop-based sellers.

  `CAP-0090`    P1         §355     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:CAP-0090

  `CAP-0091`    P1         §355     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:CAP-0091

  `CAP-0092`    P1         §355     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:CAP-0092

  `CAP-0093`    P1         §355     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:CAP-0093

  `CAP-0094`    P1         §355     `DEFERRED_VERIFICATION`   ---              ---        --- baseline/open; backlog:CAP-0094

  `PRD-0331`    P1         §356      `DEFERRED_VERIFICATION`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,apps/web/src/buyer-api/handler.ts   tests/m10-postgres-integration.mjs,tests/m11-postgres-integration.mjs,tests/m13-postgres-integration.mjs   M13 web, Agent and REST share Core contracts; full isolated paid Worker and both-provider proof remain OPEN. backlog:PRD-0331

  `PRD-0332`    P2         §356      `DEFERRED_VERIFICATION`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,apps/web/src/buyer-api/handler.ts   tests/m10-postgres-integration.mjs,tests/m11-postgres-integration.mjs,tests/m13-postgres-integration.mjs   M13 web, Agent and REST share Core contracts; full isolated paid Worker and both-provider proof remain OPEN. backlog:PRD-0332

  `CAP-0095`    P1         §357      `TODO`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   OPEN later-owned implementation: M14 seller example authoring UI; M10 public catalog primitive available where applicable

  `CAP-0096`    P1         §357      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `CAP-0097`    P1         §357      `TODO`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   OPEN later-owned implementation: M14 seller example authoring guidance; M10 public catalog primitive available where applicable

  `CAP-0098`    P1         §358      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `CAP-0099`    P1         §358      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `CAP-0100`    P1         §358      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `CAP-0101`    P1         §359      `TODO`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   OPEN later-owned implementation: M14 real seller Test Playground→example publication; M10 public catalog primitive available where applicable

  `PRD-0333`    P1         §360      `VERIFIED`   packages/contracts/src/file-types.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-catalog.ts,apps/web/app/capabilities/[slug]/example-asset.tsx,apps/web/src/marketplace/handler.ts   tests/browser-m10/media-examples.spec.ts,tests/m10-postgres-integration.mjs,docs/evidence/m16-media-examples.md   Real seller-approved SeaweedFS media, safe field-based names, no raw asset IDs/host paths, CSP/iframe sandbox, desktop/mobile/axe and authenticated download; browser suite 4/4.

  `PRD-0334`    P2         §360      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `PRD-0335`    P2         §360      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `IO-0138`    P1         §361      `VERIFIED`   packages/contracts/src/file-types.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-catalog.ts,apps/web/app/capabilities/[slug]/example-asset.tsx,apps/web/src/marketplace/handler.ts   tests/browser-m10/media-examples.spec.ts,tests/m10-postgres-integration.mjs,docs/evidence/m16-media-examples.md   Real seller-approved SeaweedFS media, safe field-based names, no raw asset IDs/host paths, CSP/iframe sandbox, desktop/mobile/axe and authenticated download; browser suite 4/4.

  `IO-0139`    P1         §361      `VERIFIED`   packages/contracts/src/file-types.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-catalog.ts,apps/web/app/capabilities/[slug]/example-asset.tsx,apps/web/src/marketplace/handler.ts   tests/browser-m10/media-examples.spec.ts,tests/m10-postgres-integration.mjs,docs/evidence/m16-media-examples.md   Real seller-approved SeaweedFS media, safe field-based names, no raw asset IDs/host paths, CSP/iframe sandbox, desktop/mobile/axe and authenticated download; browser suite 4/4.

  `CAP-0102`    P1         §362      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `CAP-0103`    P1         §362      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `CAP-0104`    P1         §362      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `PRD-0336`    P1         §363      `TODO`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   OPEN later-owned implementation: M14 seller approval UI for public example assets; M10 public catalog primitive available where applicable

  `PRD-0337`    P2         §363      `OPEN_IMPLEMENTATION`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 component evidence; full gate OPEN; backlog:PRD-0337

  `PRD-0338`    P2         §363      `OPEN_IMPLEMENTATION`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 component evidence; full gate OPEN; backlog:PRD-0338

  `PRD-0339`    P2         §363      `OPEN_IMPLEMENTATION`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 component evidence; full gate OPEN; backlog:PRD-0339

  `IO-0140`    P1         §364      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `IO-0141`    P1         §364      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `IO-0142`    P1         §364      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `CAP-0105`    P1         §365      `TODO`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   OPEN later-owned implementation: M14 version-change example compatibility workflow; M10 public catalog primitive available where applicable

  `CAP-0106`    P1         §365      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `CAP-0107`    P1         §365      `TODO`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   OPEN later-owned implementation: M14 seller revalidation before using an old example; M10 public catalog primitive available where applicable

  `CAP-0108`    P1         §365      `TODO`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   OPEN later-owned implementation: M14 runtime/model/skill-change rerun guidance; M10 public catalog primitive available where applicable

  `PRD-0340`    P1         §366      `TODO`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   OPEN later-owned implementation: M11 Marketplace Agent; M10 public catalog primitive available where applicable

  `PRD-0341`    P2         §366      `TODO`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   OPEN later-owned implementation: M11 Marketplace Agent; M10 public catalog primitive available where applicable

  `IO-0143`    P1         §367      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `IO-0144`    P1         §367      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M10 PostgreSQL/browser evidence; docs/milestones/M10.md

  `CAP-0109`    P1         §368      `TODO`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   OPEN later-owned implementation: M11 Agent, M14 real test publication and M16 media acceptance; M10 public catalog primitive available where applicable

  `OBS-0007`    P1         §369     `VERIFIED`   apps/worker/src/execution-runtime.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m16-installed-worker-e2e.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   Signed paid Worker health, derived seller status, diagnostics and desktop/mobile buyer/seller checks. docs/evidence/m16-health-trust-review.md.

  `OBS-0008`    P2         §369     `VERIFIED`   apps/worker/src/execution-runtime.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m16-installed-worker-e2e.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   Signed paid Worker health, derived seller status, diagnostics and desktop/mobile buyer/seller checks. docs/evidence/m16-health-trust-review.md.

  `OBS-0009`    P2         §369     `VERIFIED`   apps/worker/src/execution-runtime.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m16-installed-worker-e2e.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   Signed paid Worker health, derived seller status, diagnostics and desktop/mobile buyer/seller checks. docs/evidence/m16-health-trust-review.md.

  `OBS-0010`    P2         §369     `VERIFIED`   apps/worker/src/execution-runtime.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m16-installed-worker-e2e.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   Signed paid Worker health, derived seller status, diagnostics and desktop/mobile buyer/seller checks. docs/evidence/m16-health-trust-review.md.

  `WRK-0101`    P1         §370     `VERIFIED`   apps/worker/src/execution-runtime.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m16-installed-worker-e2e.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   Signed paid Worker health, derived seller status, diagnostics and desktop/mobile buyer/seller checks. docs/evidence/m16-health-trust-review.md.

  `WRK-0102`    P1         §370     `VERIFIED`   apps/worker/src/execution-runtime.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m16-installed-worker-e2e.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   Signed paid Worker health, derived seller status, diagnostics and desktop/mobile buyer/seller checks. docs/evidence/m16-health-trust-review.md.

  `CAP-0110`    P1         §371     `DEFERRED_VERIFICATION`   apps/worker/src/health.ts,packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-postgres-integration.mjs,tests/worker-cli.test.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:CAP-0110

  `CAP-0111`    P1         §371     `DEFERRED_VERIFICATION`   apps/worker/src/health.ts,packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-postgres-integration.mjs,tests/worker-cli.test.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:CAP-0111

  `CAP-0112`    P1         §371     `DEFERRED_VERIFICATION`   apps/worker/src/health.ts,packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-postgres-integration.mjs,tests/worker-cli.test.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:CAP-0112

  `CAP-0113`    P1         §371     `DEFERRED_VERIFICATION`   apps/worker/src/health.ts,packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-postgres-integration.mjs,tests/worker-cli.test.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:CAP-0113

  `WRK-0103`    P1         §372     `DEFERRED_VERIFICATION`   apps/worker/src/health.ts,packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-postgres-integration.mjs,tests/worker-cli.test.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:WRK-0103

  `SEC-0108`    P1         §373     `VERIFIED`   apps/worker/src/health.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/seller-operations.ts   tests/m16-installed-worker-e2e.mjs,tests/m07-postgres-integration.mjs,tests/m12-postgres-integration.mjs,tests/worker-operational-health.test.mjs   Signed Docker/image/self-test admission; missing or failing proof blocks dispatch and security-critical self-test auto-pauses. docs/evidence/m16-health-trust-review.md.

  `SEC-0109`    P0         §373     `VERIFIED`   apps/worker/src/health.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/seller-operations.ts   tests/m16-installed-worker-e2e.mjs,tests/m07-postgres-integration.mjs,tests/m12-postgres-integration.mjs,tests/worker-operational-health.test.mjs   Signed Docker/image/self-test admission; missing or failing proof blocks dispatch and security-critical self-test auto-pauses. docs/evidence/m16-health-trust-review.md.

  `SEC-0110`    P0         §373     `VERIFIED`   apps/worker/src/health.ts,packages/sandbox-adapter/src/docker.ts   tests/docker-job-control-local-integration.mjs,tests/worker-cli.test.mjs   M12 Docker/image failures block readiness; M07 real Docker isolation uses no host-execution fallback.

  `WRK-0104`    P1         §374     `VERIFIED`   apps/worker/src/dispatch-loop.ts,packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/availability.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-postgres-integration.mjs,tests/m09-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-heartbeat-health.md   M16 original-source review and current-tree 32/32 boundary matrix; no Stripe or deployed-provider acceptance claimed.

  `WRK-0105`    P1         §374     `VERIFIED`   packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/availability.ts   tests/m12-postgres-integration.mjs,tests/m09-postgres-integration.mjs   M12 TTL marks Worker offline; M09 public availability refuses dispatch without a fresh signed heartbeat.

  `JOB-0090`    P1         §375     `VERIFIED`   packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m16-installed-worker-e2e.mjs,tests/m12-postgres-integration.mjs   Paid success/failure/cancellation and seven-day metrics compared with authoritative job counts in seller browser. docs/evidence/m16-health-trust-review.md.

  `JOB-0091`    P1         §375     `VERIFIED`   packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m16-installed-worker-e2e.mjs,tests/m12-postgres-integration.mjs   Paid success/failure/cancellation and seven-day metrics compared with authoritative job counts in seller browser. docs/evidence/m16-health-trust-review.md.

  `JOB-0092`    P1         §375     `VERIFIED`   packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m16-installed-worker-e2e.mjs,tests/m12-postgres-integration.mjs   Paid success/failure/cancellation and seven-day metrics compared with authoritative job counts in seller browser. docs/evidence/m16-health-trust-review.md.

  `JOB-0093`    P1         §375     `VERIFIED`   packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m16-installed-worker-e2e.mjs,tests/m12-postgres-integration.mjs   Paid success/failure/cancellation and seven-day metrics compared with authoritative job counts in seller browser. docs/evidence/m16-health-trust-review.md.

  `OBS-0011`    P1         §376     `VERIFIED`   apps/worker/src/health.ts,packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-postgres-integration.mjs,tests/worker-cli.test.mjs,tests/browser-m12/seller-operations.spec.ts,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-capability-health-browser.md   M16 production Worker reporter emits two independent readiness states on one ONLINE device; PostgreSQL persists them, buyer availability and seller dashboard retain separate runtime and capacity/queue states; browser and live single-dependency outage regressions pass. docs/evidence/m16-capability-health-browser.md.

  `SEC-0111`    P1         §377     `VERIFIED`   apps/worker/src/runtime-readiness.ts,apps/worker/src/availability-reporter.ts,packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-runtime-readiness.test.mjs,tests/availability-reporter.test.mjs,tests/m09-postgres-integration.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts,docs/evidence/m16-security-warning-review.md   Signed health, durable security blocks and per-capability revalidation produce severity/action/affected target/detection/blocking fields; authenticated seller browser renders accessible warnings.

  `SEC-0112`    P0         §377     `VERIFIED`   apps/worker/src/runtime-readiness.ts,apps/worker/src/availability-reporter.ts,packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-runtime-readiness.test.mjs,tests/availability-reporter.test.mjs,tests/m09-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts,docs/evidence/m16-security-warning-review.md   Changed reviewed runtime reports DEPENDENCY_BLOCKED over signed heartbeat, blocks paid admission and produces an explicit seller capability-revalidation warning and action.

  `SEC-0113`    P1         §378     `VERIFIED`   apps/worker/src/health.ts,packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts,docs/evidence/m16-security-warning-review.md   Critical version/image/sandbox failures durably block new jobs before dashboard observation; seller sees CRITICAL blocking alert, cannot blindly resume and healthy recheck is required to clear.

  `SEC-0114`    P0         §378     `VERIFIED`   apps/worker/src/health.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/seller-operations.ts   tests/m16-installed-worker-e2e.mjs,tests/m07-postgres-integration.mjs,tests/m12-postgres-integration.mjs,tests/worker-operational-health.test.mjs   Signed Docker/image/self-test admission; missing or failing proof blocks dispatch and security-critical self-test auto-pauses. docs/evidence/m16-health-trust-review.md.

  `SEC-0115`    P0         §378     `VERIFIED`   apps/worker/src/health.ts,packages/persistence/src/job-execution.ts,packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/seller-operations.ts   tests/m16-installed-worker-e2e.mjs,tests/m07-postgres-integration.mjs,tests/m12-postgres-integration.mjs,tests/worker-operational-health.test.mjs   Signed Docker/image/self-test admission; missing or failing proof blocks dispatch and security-critical self-test auto-pauses. docs/evidence/m16-health-trust-review.md.

  `WRK-0106`    P1         §379     `VERIFIED`   apps/worker/src/health.ts,packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-postgres-integration.mjs,tests/worker-cli.test.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-worker-cli-health.md   M16 actual connected installed Worker health and active Docker doctor checks passed; paused/unready and redaction CLI regressions passed.

  `WRK-0107`    P1         §379     `VERIFIED`   apps/worker/src/cli.ts   tests/worker-cli.test.mjs   JSON health option

  `WRK-0108`    P1         §380     `VERIFIED`   apps/worker/src/health.ts,packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-postgres-integration.mjs,tests/worker-cli.test.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-worker-cli-health.md   M16 actual connected installed Worker health and active Docker doctor checks passed; paused/unready and redaction CLI regressions passed.

  `WRK-0109`    P1         §381     `VERIFIED`   packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m13-postgres-integration.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts,docs/evidence/m16-health-history.md   M16 transition-only sanitized health history and seller capability timeline verified on current tree.

  `WRK-0110`    P1         §381     `VERIFIED`   packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m13-postgres-integration.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts,docs/evidence/m16-health-history.md   M16 transition-only sanitized health history and seller capability timeline verified on current tree.

  `WRK-0111`    P1         §381     `VERIFIED`   packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m13-postgres-integration.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts,docs/evidence/m16-health-history.md   M16 transition-only sanitized health history and seller capability timeline verified on current tree.

  `JOB-0094`    P1         §382     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0094

  `JOB-0095`    P1         §382     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0095

  `JOB-0096`    P1         §383     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0096

  `JOB-0097`    P1         §383     `VERIFIED`   apps/worker/src/local-state.ts,apps/worker/src/cli.ts   tests/m12-local-control.test.mjs,tests/worker-cli.test.mjs   Local emergency pause commits synchronously without contacting cloud and blocks new offers.

  `JOB-0098`    P1         §384     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0098

  `JOB-0099`    P1         §384     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0099

  `JOB-0100`    P1         §384     `VERIFIED`   apps/worker/src/local-state.ts   tests/m12-local-control.test.mjs,tests/worker-cli.test.mjs   Persisted local pause remains until explicit readiness-gated seller resume.

  `JOB-0101`    P1         §385     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0101

  `JOB-0102`    P1         §385     `VERIFIED`   apps/web/app/seller/operations-dashboard.tsx,apps/web/src/seller/operations-handler.ts   tests/browser-m12/seller-operations.spec.ts   One seller action records web emergency pause without multi-step confirmation.

  `JOB-0103`    P1         §385     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0103

  `JOB-0104`    P1         §386     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0104

  `JOB-0105`    P1         §387     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0105

  `JOB-0106`    P1         §388     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0106

  `JOB-0107`    P1         §388     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0107

  `JOB-0108`    P1         §388     `VERIFIED`   apps/worker/src/cli.ts,apps/worker/src/local-control-outbox.ts   tests/worker-cli.test.mjs,tests/m12-local-control-outbox.test.mjs   Separate stop --all command requires explicit --confirm and records cancellative local control for cloud reconciliation.

  `JOB-0109`    P1         §388     `VERIFIED`   apps/worker/src/local-state.ts,apps/worker/src/cli.ts   tests/m12-local-control.test.mjs,tests/worker-cli.test.mjs   Pause only blocks new admission; stop --all is a separate confirmed destructive action.

  `JOB-0110`    P1         §389     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0110

  `JOB-0111`    P1         §389     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0111

  `JOB-0112`    P1         §390     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0112

  `JOB-0113`    P1         §391     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0113

  `JOB-0114`    P1         §391     `VERIFIED`   apps/worker/src/local-state.ts,packages/persistence/src/availability.ts   tests/m12-local-control.test.mjs,tests/m09-postgres-integration.mjs   Local and Core state both prevent capability resume from overriding global pause.

  `PRD-0342`    P1         §392     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:PRD-0342

  `PRD-0343`    P2         §392     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:PRD-0343

  `PRD-0344`    P2         §392     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:PRD-0344

  `SEC-0116`    P1         §393     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:SEC-0116

  `SEC-0117`    P0         §393     `VERIFIED`   apps/worker/src/local-state.ts,packages/persistence/src/seller-operations.ts   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs   Seller resume is denied while platform security block is active; no seller route clears the latch.

  `SEC-0118`    P0         §393     `VERIFIED`   packages/persistence/src/seller-operations.ts,apps/worker/src/local-state.ts   tests/m12-postgres-integration.mjs,tests/m12-local-control.test.mjs   Trusted platform clear requires fresh healthy signed observations and a newer directive; local independent block remains.

  `JOB-0115`    P1         §394     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0115

  `JOB-0116`    P1         §394     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0116

  `JOB-0117`    P1         §394     `VERIFIED`   apps/worker/src/local-state.ts,packages/persistence/src/seller-operations.ts   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs   Blocking security pause rejects seller resume until platform policy clearance.

  `PRD-0345`    P1         §395     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:PRD-0345

  `PRD-0346`    P2         §395     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:PRD-0346

  `PRD-0347`    P2         §395     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:PRD-0347

  `PRD-0348`    P2         §395     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts,apps/worker/src/control-sync.ts,packages/persistence/src/seller-operations.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m12-local-control.test.mjs,tests/m12-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:PRD-0348

  `PRD-0349`    P1         §396      `VERIFIED`   apps/web/app/seller/operations-dashboard.tsx,apps/web/src/seller/operations-handler.ts,packages/persistence/src/availability.ts   tests/browser-m12/seller-operations.spec.ts,tests/availability-schedule.test.mjs,tests/m09-postgres-integration.mjs   M12 browser saved an overnight seller-local schedule, copied weekdays and rendered next-window/seven-day preview; M09 Core enforces it.

  `PRD-0350`    P2         §396      `VERIFIED`   apps/web/app/seller/operations-dashboard.tsx,apps/web/src/seller/operations-handler.ts,packages/persistence/src/availability.ts   tests/browser-m12/seller-operations.spec.ts,tests/availability-schedule.test.mjs,tests/m09-postgres-integration.mjs   M12 browser saved an overnight seller-local schedule, copied weekdays and rendered next-window/seven-day preview; M09 Core enforces it.

  `AVL-0021`    P1         §397      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts,tests/m09-postgres-integration.mjs   PUBLIC schedule-closed listing and next availability on detail

  `AVL-0022`    P1         §398      `VERIFIED`   apps/web/app/seller/operations-dashboard.tsx,apps/web/src/seller/operations-handler.ts,packages/persistence/src/availability.ts   tests/browser-m12/seller-operations.spec.ts,tests/availability-schedule.test.mjs,tests/m09-postgres-integration.mjs   M12 browser saved an overnight seller-local schedule, copied weekdays and rendered next-window/seven-day preview; M09 Core enforces it.

  `AVL-0023`    P1         §398      `VERIFIED`   apps/web/app/seller/operations-dashboard.tsx,apps/web/src/seller/operations-handler.ts,packages/persistence/src/availability.ts   tests/browser-m12/seller-operations.spec.ts,tests/availability-schedule.test.mjs,tests/m09-postgres-integration.mjs   M12 browser saved an overnight seller-local schedule, copied weekdays and rendered next-window/seven-day preview; M09 Core enforces it.

  `AVL-0024`    P1         §399      `VERIFIED`   packages/domain/src/availability-schedule.ts,packages/contracts/src/availability.ts   tests/availability-schedule.test.mjs,tests/scheduled-job-metrics.test.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0025`    P1         §399      `VERIFIED`   packages/domain/src/availability-schedule.ts,packages/contracts/src/availability.ts   tests/availability-schedule.test.mjs,tests/scheduled-job-metrics.test.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0026`    P1         §399      `VERIFIED`   packages/domain/src/availability-schedule.ts,packages/contracts/src/availability.ts   tests/availability-schedule.test.mjs,tests/scheduled-job-metrics.test.mjs   M09 Core verified; docs/milestones/M09.md

  `UI-0026`    P1         §400      `VERIFIED`   apps/web/app/seller/operations-dashboard.tsx,apps/web/src/seller/operations-handler.ts,packages/persistence/src/availability.ts   tests/browser-m12/seller-operations.spec.ts,tests/availability-schedule.test.mjs,tests/m09-postgres-integration.mjs   M12 browser saved an overnight seller-local schedule, copied weekdays and rendered next-window/seven-day preview; M09 Core enforces it.

  `UI-0027`    P2         §400      `VERIFIED`   apps/web/app/seller/operations-dashboard.tsx,apps/web/src/seller/operations-handler.ts,packages/persistence/src/availability.ts   tests/browser-m12/seller-operations.spec.ts,tests/availability-schedule.test.mjs,tests/m09-postgres-integration.mjs   M12 browser saved an overnight seller-local schedule, copied weekdays and rendered next-window/seven-day preview; M09 Core enforces it.

  `AVL-0027`    P1         §401      `VERIFIED`   packages/domain/src/availability-schedule.ts,packages/contracts/src/availability.ts   tests/availability-schedule.test.mjs,tests/scheduled-job-metrics.test.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0028`    P1         §401      `VERIFIED`   packages/domain/src/availability-schedule.ts,packages/contracts/src/availability.ts   tests/availability-schedule.test.mjs,tests/scheduled-job-metrics.test.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0029`    P1         §402      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0030`    P1         §402      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0031`    P1         §402      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0032`    P1         §403      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts,tests/m09-postgres-integration.mjs   Browser rendered all five authoritative availability states

  `AVL-0033`    P1         §404      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts,tests/m09-postgres-integration.mjs   Immediate schedule-closed checkout refused before reservation

  `AVL-0034`    P1         §404      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts,tests/m09-postgres-integration.mjs   Immediate schedule-closed checkout refused before reservation

  `AVL-0035`    P1         §405      `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/persistence/src/availability.ts   tests/m11-agent.test.mjs,tests/m09-postgres-integration.mjs   M11 excludes scheduled-offline supply for immediate intent and includes it only with explicit waiting; next time is M09 Core-derived.

  `AVL-0036`    P1    §405    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent.ts,packages/application/src/marketplace-agent-planner.ts,packages/domain/src/agent-plan.ts   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs   M11 closes prior deferred gate with current published supply, deterministic constraints and test evidence; docs/milestones/M11.md.

  `AVL-0037`    P1         §406      `VERIFIED`   apps/web/src/buyer-api/handler.ts,packages/persistence/src/availability.ts   tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `AVL-0038`    P1         §406      `VERIFIED`   apps/web/src/buyer-api/handler.ts,packages/persistence/src/availability.ts   tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `JOB-0118`    P1         §407      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `JOB-0119`    P1         §407      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `JOB-0120`    P1         §408      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `JOB-0121`    P1         §408      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `JOB-0122`    P1         §408      `DEFERRED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   Explicitly optional later stricter queued-job mode in Master Spec §408; MVP roll-forward policy verified

  `JOB-0123`    P1         §408      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `JOB-0124`    P1         §408      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `JOB-0125`    P1         §408      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `JOB-0126`    P1         §409      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `JOB-0127`    P1         §409      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `JOB-0128`    P1         §409      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0039`    P1         §410      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0040`    P1         §410      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0041`    P1         §410      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `JOB-0129`    P1         §411      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `JOB-0130`    P1         §411      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `JOB-0131`    P1         §412      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `JOB-0132`    P1         §412      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0042`    P1         §413      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0043`    P1         §413      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0044`    P1         §413      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `PRD-0351`    P1         §414      `VERIFIED`   packages/persistence/src/availability.ts,apps/web/app/seller/operations-dashboard.tsx,apps/worker/src/runtime-readiness.ts   tests/m09-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-paid-schedule-window.md   Seller-owned service hours and capacity govern actual paid Worker admission; closed-window REST purchase creates neither job nor reservation, while running execution survives policy edit as specified.

  `PRD-0352`    P2         §414      `VERIFIED`   packages/persistence/src/availability.ts,apps/web/app/seller/operations-dashboard.tsx,apps/worker/src/runtime-readiness.ts   tests/m09-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-paid-schedule-window.md   Actual paid Docker/OpenClaw Worker obeys seller-selected schedule and concurrency; out-of-window buyer/API attempt is denied before credit reservation.

  `AVL-0045`    P1         §415      `DEFERRED_VERIFICATION`   packages/persistence/src/availability.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m09-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:AVL-0045

  `AVL-0046`    P1         §415      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0047`    P1         §415      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `PRD-0353`    P1         §416      `VERIFIED`   apps/web/app/seller/operations-dashboard.tsx,packages/persistence/src/availability.ts   tests/browser-m12/seller-operations.spec.ts,tests/m09-postgres-integration.mjs   M12 seller UI explicitly explains that Kivro does not wake a sleeping computer; M09 marks missing Worker heartbeat offline.

  `PRD-0354`    P2         §416      `VERIFIED`   apps/web/app/seller/operations-dashboard.tsx,packages/persistence/src/availability.ts   tests/browser-m12/seller-operations.spec.ts,tests/m09-postgres-integration.mjs   M12 seller UI explicitly explains that Kivro does not wake a sleeping computer; M09 marks missing Worker heartbeat offline.

  `PRD-0355`    P2         §416      `VERIFIED`   apps/web/app/seller/operations-dashboard.tsx,packages/persistence/src/availability.ts   tests/browser-m12/seller-operations.spec.ts,tests/m09-postgres-integration.mjs   M12 seller UI explicitly explains that Kivro does not wake a sleeping computer; M09 marks missing Worker heartbeat offline.

  `AVL-0048`    P1         §417      `VERIFIED`   packages/domain/src/availability-schedule.ts,packages/contracts/src/availability.ts   tests/availability-schedule.test.mjs,tests/scheduled-job-metrics.test.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0049`    P1         §418      `VERIFIED`   apps/web/app/seller/operations-dashboard.tsx,apps/web/src/seller/operations-handler.ts,packages/persistence/src/availability.ts   tests/browser-m12/seller-operations.spec.ts,tests/availability-schedule.test.mjs,tests/m09-postgres-integration.mjs   M12 browser saved an overnight seller-local schedule, copied weekdays and rendered next-window/seven-day preview; M09 Core enforces it.

  `AVL-0050`    P1         §418      `VERIFIED`   apps/web/app/seller/operations-dashboard.tsx,apps/web/src/seller/operations-handler.ts,packages/persistence/src/availability.ts   tests/browser-m12/seller-operations.spec.ts,tests/availability-schedule.test.mjs,tests/m09-postgres-integration.mjs   M12 browser saved an overnight seller-local schedule, copied weekdays and rendered next-window/seven-day preview; M09 Core enforces it.

  `PRD-0356`    P1         §419      `VERIFIED`   apps/web/app/capabilities/[slug]/local-availability-time.tsx,apps/web/app/capabilities/[slug]/page.tsx,packages/persistence/src/availability.ts   tests/browser-m10/marketplace.spec.ts,tests/availability-schedule.test.mjs   M12 correction renders an absolute server instant then buyer-local time after hydration; M10 browser asserts the real scheduled-offline detail time.

  `PRD-0357`    P2         §419      `VERIFIED`   apps/web/app/capabilities/[slug]/local-availability-time.tsx,apps/web/app/capabilities/[slug]/page.tsx,packages/persistence/src/availability.ts   tests/browser-m10/marketplace.spec.ts,tests/availability-schedule.test.mjs   M12 correction renders an absolute server instant then buyer-local time after hydration; M10 browser asserts the real scheduled-offline detail time.

  `PRD-0358`    P2         §419      `VERIFIED`   apps/web/app/capabilities/[slug]/local-availability-time.tsx,apps/web/app/capabilities/[slug]/page.tsx,packages/persistence/src/availability.ts   tests/browser-m10/marketplace.spec.ts,tests/availability-schedule.test.mjs   M12 correction renders an absolute server instant then buyer-local time after hydration; M10 browser asserts the real scheduled-offline detail time.

  `AVL-0051`    P1         §420      `VERIFIED`   apps/web/src/buyer-api/handler.ts,packages/persistence/src/availability.ts   tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `AVL-0052`    P1         §420      `VERIFIED`   apps/web/src/buyer-api/handler.ts,packages/persistence/src/availability.ts   tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `PRD-0359`    P1         §421      `VERIFIED`   apps/web/src/buyer-api/handler.ts,packages/persistence/src/availability.ts   tests/m13-postgres-integration.mjs   M13 real bearer REST, Core, PostgreSQL and browser evidence.

  `JOB-0133`    P1         §422      `VERIFIED`   packages/persistence/src/availability.ts,apps/web/src/seller/operations-handler.ts,apps/worker/src/broker-sidecar.ts,runtime/openclaw/bridge.mjs   tests/m09-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts,tests/docker-broker-sidecar-local-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-paid-schedule-window.md   Seller-scoped policy revision is authoritative; paid hostile buyer prompt cannot alter it; offline sandbox broker denies all operational control routes.

  `JOB-0134`    P1         §422      `VERIFIED`   packages/persistence/src/availability.ts,apps/worker/src/broker-sidecar.ts,runtime/openclaw/bridge.mjs   tests/m09-postgres-integration.mjs,tests/docker-broker-sidecar-local-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-paid-schedule-window.md   Real Docker broker rejects schedule/resume/capacity routes; hostile buyer input in paid execution cannot mutate seller policy revision.

  `AVL-0053`    P1         §423      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0054`    P1         §424      `VERIFIED`   packages/persistence/src/availability.ts,apps/web/app/seller/operations-dashboard.tsx,apps/web/src/buyer-api/handler.ts,packages/application/src/marketplace-agent.ts   tests/availability-schedule.test.mjs,tests/m09-postgres-integration.mjs,tests/m11-agent.test.mjs,tests/m13-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts,tests/browser-m12/seller-operations.spec.ts,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-schedule-acceptance.md   All 19 original §424 automated schedule checks mapped to executed Core, buyer, API, Agent, seller and paid Worker tests; physical sleep and deployed provider parity remain separate gates.

  `AVL-0055`    P1         §424      `VERIFIED`   packages/persistence/src/availability.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m09-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts,docs/evidence/m16-schedule-purchase-denial.md   M16 authenticated seller browser saved Custom then Always Available and PostgreSQL confirmed the persisted policy; broader §424 matrix remains separate.

  `AVL-0056`    P1         §424      `VERIFIED`   packages/persistence/src/availability.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m09-postgres-integration.mjs,tests/m13-postgres-integration.mjs,docs/evidence/m16-schedule-purchase-denial.md   M16 Core and real REST paid purchase denial outside seller schedule passed; no reservation; broader §424 matrix remains separate.

  `AVL-0057`    P1         §424      `VERIFIED`   packages/persistence/src/availability.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m09-postgres-integration.mjs,tests/m13-postgres-integration.mjs,docs/evidence/m16-schedule-purchase-denial.md   M16 Core and real REST paid purchase denial outside seller schedule passed; no reservation; broader §424 matrix remains separate.

  `AVL-0058`    P1         §424      `VERIFIED`   packages/persistence/src/availability.ts,apps/worker/src/broker-sidecar.ts,runtime/openclaw/bridge.mjs   tests/m09-postgres-integration.mjs,tests/docker-broker-sidecar-local-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-paid-schedule-window.md   A real paid hostile buyer input cannot change schedule revision or concurrency; Docker broker rejects all operational control routes and Core requires seller ownership.

  `PRD-0360`    P1         §425      `VERIFIED`   packages/persistence/src/availability.ts,packages/persistence/src/marketplace-buyer.ts,apps/worker/src/job-admission.ts   tests/m09-postgres-integration.mjs,tests/m10-postgres-integration.mjs,tests/m12-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-availability-hierarchy.md   M16 six-layer visibility/control/schedule/device/readiness/capacity review uses authoritative Core and real paid Worker/browser evidence; blocked layers prevent new paid execution.

  `PRD-0361`    P2         §425      `VERIFIED`   packages/persistence/src/availability.ts,packages/persistence/src/marketplace-buyer.ts   tests/m09-postgres-integration.mjs,tests/m10-postgres-integration.mjs,tests/m12-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-availability-hierarchy.md   Marketplace availability is computed from six independent authoritative layers, not a single Worker online flag.

  `PRD-0362`    P2         §425      `VERIFIED`   packages/persistence/src/availability.ts,packages/persistence/src/marketplace-buyer.ts,apps/worker/src/job-admission.ts   tests/m09-postgres-integration.mjs,tests/m12-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-availability-hierarchy.md   Quote/booking/dispatch/local admission recheck the relevant layers; paid work is denied or retained without execution when any layer blocks.

  `PRD-0363`    P2         §425      `VERIFIED`   packages/persistence/src/availability.ts,packages/persistence/src/marketplace-buyer.ts,apps/worker/src/job-admission.ts   tests/m09-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-availability-hierarchy.md   Seller control, schedule and capacity remain independent authorities at paid execution boundary.

  `PRD-0364`    P2         §425      `VERIFIED`   packages/persistence/src/availability.ts,apps/worker/src/job-admission.ts   tests/m09-postgres-integration.mjs,tests/browser-m12/seller-operations.spec.ts,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-availability-hierarchy.md   Real paid Worker respects seller-selected execution period, one-slot limit and pause/readiness gates; closed-window API request creates no reservation or job.

  `JOB-0135`    P1         §426     `VERIFIED`   packages/persistence/src/job-execution.ts,apps/worker/src/job-control.ts,apps/worker/src/execution-supervisor.ts,apps/worker/src/broker-sidecar.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m16-installed-worker-e2e.mjs,tests/m12-postgres-integration.mjs,tests/worker-job-control.test.mjs,tests/browser-m12/seller-operations.spec.ts,docs/evidence/m16-capacity-and-pause-closure.md   M16 authentic seller Web paid pause/resume proves Core request, Worker Docker acknowledgement, paused provider barrier, truthful UI and one settlement; owner, replay, capability/global pause and offline CLI have separate regressions.

  `JOB-0136`    P1         §426     `VERIFIED`   packages/persistence/src/job-execution.ts,apps/worker/src/job-control.ts,apps/worker/src/execution-supervisor.ts,apps/worker/src/broker-sidecar.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m16-installed-worker-e2e.mjs,tests/m12-postgres-integration.mjs,tests/worker-job-control.test.mjs,tests/browser-m12/seller-operations.spec.ts,docs/evidence/m16-capacity-and-pause-closure.md   M16 authentic seller Web paid pause/resume proves Core request, Worker Docker acknowledgement, paused provider barrier, truthful UI and one settlement; owner, replay, capability/global pause and offline CLI have separate regressions.

  `JOB-0137`    P1         §426     `VERIFIED`   packages/persistence/src/job-execution.ts,apps/worker/src/job-control.ts,apps/worker/src/execution-supervisor.ts,apps/worker/src/broker-sidecar.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m16-installed-worker-e2e.mjs,tests/m12-postgres-integration.mjs,tests/worker-job-control.test.mjs,tests/browser-m12/seller-operations.spec.ts,docs/evidence/m16-capacity-and-pause-closure.md   M16 authentic seller Web paid pause/resume proves Core request, Worker Docker acknowledgement, paused provider barrier, truthful UI and one settlement; owner, replay, capability/global pause and offline CLI have separate regressions.

  `JOB-0138`    P1         §427     `VERIFIED`   packages/persistence/src/job-execution.ts,apps/worker/src/job-control.ts,apps/worker/src/execution-supervisor.ts,apps/worker/src/broker-sidecar.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m16-installed-worker-e2e.mjs,tests/m12-postgres-integration.mjs,tests/worker-job-control.test.mjs,tests/browser-m12/seller-operations.spec.ts,docs/evidence/m16-capacity-and-pause-closure.md   M16 authentic seller Web paid pause/resume proves Core request, Worker Docker acknowledgement, paused provider barrier, truthful UI and one settlement; owner, replay, capability/global pause and offline CLI have separate regressions.

  `JOB-0139`    P1         §428     `VERIFIED`   packages/persistence/src/job-execution.ts,apps/worker/src/job-control.ts,apps/worker/src/execution-supervisor.ts,apps/worker/src/broker-sidecar.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m16-installed-worker-e2e.mjs,tests/m12-postgres-integration.mjs,tests/worker-job-control.test.mjs,tests/browser-m12/seller-operations.spec.ts,docs/evidence/m16-capacity-and-pause-closure.md   M16 authentic seller Web paid pause/resume proves Core request, Worker Docker acknowledgement, paused provider barrier, truthful UI and one settlement; owner, replay, capability/global pause and offline CLI have separate regressions.

  `JOB-0140`    P1         §428     `VERIFIED`   packages/persistence/src/job-execution.ts,apps/worker/src/job-control.ts,apps/worker/src/execution-supervisor.ts,apps/worker/src/broker-sidecar.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m16-installed-worker-e2e.mjs,tests/m12-postgres-integration.mjs,tests/worker-job-control.test.mjs,tests/browser-m12/seller-operations.spec.ts,docs/evidence/m16-capacity-and-pause-closure.md   M16 authentic seller Web paid pause/resume proves Core request, Worker Docker acknowledgement, paused provider barrier, truthful UI and one settlement; owner, replay, capability/global pause and offline CLI have separate regressions.

  `JOB-0141`    P1         §428     `VERIFIED`   packages/persistence/src/job-execution.ts,apps/worker/src/job-control.ts,apps/worker/src/execution-supervisor.ts,apps/worker/src/broker-sidecar.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m16-installed-worker-e2e.mjs,tests/m12-postgres-integration.mjs,tests/worker-job-control.test.mjs,tests/browser-m12/seller-operations.spec.ts,docs/evidence/m16-capacity-and-pause-closure.md   M16 authentic seller Web paid pause/resume proves Core request, Worker Docker acknowledgement, paused provider barrier, truthful UI and one settlement; owner, replay, capability/global pause and offline CLI have separate regressions.

  `JOB-0142`    P1         §428     `VERIFIED`   packages/persistence/src/job-execution.ts,apps/worker/src/job-control.ts,apps/worker/src/execution-supervisor.ts,apps/worker/src/broker-sidecar.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m16-installed-worker-e2e.mjs,tests/m12-postgres-integration.mjs,tests/worker-job-control.test.mjs,tests/browser-m12/seller-operations.spec.ts,docs/evidence/m16-capacity-and-pause-closure.md   M16 authentic seller Web paid pause/resume proves Core request, Worker Docker acknowledgement, paused provider barrier, truthful UI and one settlement; owner, replay, capability/global pause and offline CLI have separate regressions.

  `JOB-0143`    P1         §429     `DEFERRED`   Future Worker desktop application is conditional in original §429; no local graphical Worker application is shipped. Before introducing one, implement and test offline in-flight Pause in that UI. Existing CLI and Web controls are separate and remain tested.

  `JOB-0144`    P1         §429     `DEFERRED`   Future Worker desktop application is conditional in original §429; no local graphical Worker application is shipped. Before introducing one, implement and test offline in-flight Pause in that UI. Existing CLI and Web controls are separate and remain tested.

  `JOB-0145`    P1         §429     `VERIFIED`   packages/persistence/src/job-execution.ts,apps/worker/src/job-control.ts,apps/worker/src/execution-supervisor.ts,apps/worker/src/broker-sidecar.ts,apps/web/app/seller/operations-dashboard.tsx   tests/m16-installed-worker-e2e.mjs,tests/m12-postgres-integration.mjs,tests/worker-job-control.test.mjs,tests/browser-m12/seller-operations.spec.ts,docs/evidence/m16-capacity-and-pause-closure.md   M16 authentic seller Web paid pause/resume proves Core request, Worker Docker acknowledgement, paused provider barrier, truthful UI and one settlement; owner, replay, capability/global pause and offline CLI have separate regressions.

  `JOB-0146`    P1         §430     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0146

  `JOB-0147`    P1         §430     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0147

  `JOB-0148`    P1         §430     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0148

  `JOB-0149`    P1         §431     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0149

  `JOB-0150`    P1         §431     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0150

  `JOB-0151`    P1         §431     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0151

  `JOB-0152`    P1         §431     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0152

  `JOB-0153`    P1         §431     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0153

  `JOB-0154`    P1         §431     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0154

  `JOB-0155`    P1         §432     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0155

  `JOB-0156`    P1         §432     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0156

  `JOB-0157`    P1         §432     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0157

  `JOB-0158`    P1         §432     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0158

  `JOB-0159`    P1         §433     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0159

  `JOB-0160`    P1         §433     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0160

  `JOB-0161`    P1         §433     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0161

  `JOB-0162`    P1         §433     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0162

  `JOB-0163`    P1         §433     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0163

  `JOB-0164`    P1         §434     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 records pause support truthfully and refuses publication claiming unimplemented step restart; checkpoint-runtime acceptance is later scope. backlog:JOB-0164

  `JOB-0165`    P1         §434     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 records pause support truthfully and refuses publication claiming unimplemented step restart; checkpoint-runtime acceptance is later scope. backlog:JOB-0165

  `JOB-0166`    P1         §434     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 records pause support truthfully and refuses publication claiming unimplemented step restart; checkpoint-runtime acceptance is later scope. backlog:JOB-0166

  `JOB-0167`    P1         §435     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 records pause support truthfully and refuses publication claiming unimplemented step restart; checkpoint-runtime acceptance is later scope. backlog:JOB-0167

  `JOB-0168`    P1         §435     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 records pause support truthfully and refuses publication claiming unimplemented step restart; checkpoint-runtime acceptance is later scope. backlog:JOB-0168

  `JOB-0169`    P1         §435     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 records pause support truthfully and refuses publication claiming unimplemented step restart; checkpoint-runtime acceptance is later scope. backlog:JOB-0169

  `JOB-0170`    P1         §435     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 records pause support truthfully and refuses publication claiming unimplemented step restart; checkpoint-runtime acceptance is later scope. backlog:JOB-0170

  `JOB-0171`    P1         §436     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0171

  `JOB-0172`    P1         §436     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0172

  `JOB-0173`    P1         §436     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0173

  `PRD-0365`    P1         §437     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:PRD-0365

  `PRD-0366`    P2         §437     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:PRD-0366

  `PRD-0367`    P2         §437     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:PRD-0367

  `JOB-0174`    P1         §438     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0174

  `JOB-0175`    P1         §438     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0175

  `JOB-0176`    P1         §438     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0176

  `JOB-0177`    P1         §439     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0177

  `JOB-0178`    P1         §439     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0178

  `JOB-0179`    P1         §440     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0179

  `JOB-0180`    P1         §440     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0180

  `JOB-0181`    P1         §441     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0181

  `JOB-0182`    P1         §441     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0182

  `JOB-0183`    P1         §441     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0183

  `JOB-0184`    P1         §442     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0184

  `JOB-0185`    P1         §442     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0185

  `JOB-0186`    P1         §442     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0186

  `JOB-0187`    P1         §443     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0187

  `JOB-0188`    P1         §443     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0188

  `JOB-0189`    P1         §443     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0189

  `JOB-0190`    P1         §444     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0190

  `JOB-0191`    P1         §444     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0191

  `JOB-0192`    P1         §444     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0192

  `JOB-0193`    P1         §444     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0193

  `JOB-0194`    P1         §445     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0194

  `JOB-0195`    P1         §445     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0195

  `JOB-0196`    P1         §445     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0196

  `JOB-0197`    P1         §446     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0197

  `JOB-0198`    P1         §446     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0198

  `JOB-0199`    P1         §447     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0199

  `JOB-0200`    P1         §447     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0200

  `JOB-0201`    P1         §447     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0201

  `JOB-0202`    P1         §448     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0202

  `JOB-0203`    P1         §449     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0203

  `JOB-0204`    P1         §449     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0204

  `JOB-0205`    P1         §449     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0205

  `JOB-0206`    P1         §450     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0206

  `JOB-0207`    P1         §450     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0207

  `JOB-0208`    P1         §450     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0208

  `JOB-0209`    P1         §450     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0209

  `JOB-0210`    P1         §450     `DEFERRED_VERIFICATION`   apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts,apps/web/app/seller/operations-dashboard.tsx   tests/worker-job-control.test.mjs,tests/m12-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs   M12 component evidence exists; complete cross-system acceptance remains OPEN with the exact dependency in backlog. backlog:JOB-0210

  `AVL-0059`    P1         §451      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts,tests/m09-postgres-integration.mjs   Scheduled browser purchase booked for a future window

  `AVL-0060`    P1         §451      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0061`    P1         §451      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M10 buyer checkout; M09 Core evidence in docs/milestones/M09.md

  `AVL-0062`    P1         §452      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M10 buyer CTA; M09 Core evidence in docs/milestones/M09.md

  `AVL-0063`    P1         §452      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M10 CTA wording; M09 Core evidence in docs/milestones/M09.md

  `JOB-0211`    P1         §453      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M10 buyer checkout; M09 Core evidence in docs/milestones/M09.md

  `JOB-0212`    P1         §453      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M10 buyer checkout; M09 Core evidence in docs/milestones/M09.md

  `JOB-0213`    P1         §454      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M10 buyer timing UI; M09 Core evidence in docs/milestones/M09.md

  `JOB-0214`    P1         §454      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M10 buyer timing UI; M09 Core evidence in docs/milestones/M09.md

  `JOB-0215`    P1         §455      `DEFERRED_VERIFICATION`   packages/domain/src/availability-schedule.ts,packages/contracts/src/availability.ts   tests/availability-schedule.test.mjs,tests/scheduled-job-metrics.test.mjs   M09 component evidence; full gate OPEN; backlog:JOB-0215

  `JOB-0216`    P1         §455      `DEFERRED_VERIFICATION`   packages/domain/src/availability-schedule.ts,packages/contracts/src/availability.ts   tests/availability-schedule.test.mjs,tests/scheduled-job-metrics.test.mjs   M09 component evidence; full gate OPEN; backlog:JOB-0216

  `JOB-0217`    P1         §456      `VERIFIED`   packages/domain/src/availability-schedule.ts,packages/contracts/src/availability.ts   tests/availability-schedule.test.mjs,tests/scheduled-job-metrics.test.mjs   M09 Core verified; docs/milestones/M09.md

  `JOB-0218`    P1         §457      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `JOB-0219`    P1         §457      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts,tests/m09-postgres-integration.mjs   Earliest eligibility shown without guaranteed start

  `JOB-0220`    P1         §458      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M10 buyer copy; M09 Core evidence in docs/milestones/M09.md

  `JOB-0221`    P1         §459      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts,tests/m09-postgres-integration.mjs   Buyer sees unknown completion ETA instead of invented precision

  `JOB-0222`    P1         §459      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts,tests/m09-postgres-integration.mjs   Buyer sees unknown completion ETA instead of invented precision

  `PAY-0109`    P1         §460      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts,tests/m09-postgres-integration.mjs   Scheduled quote discloses credit reservation now and later execution

  `PAY-0110`    P0         §460      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M10 checkout disclosure; M09 Core evidence in docs/milestones/M09.md

  `UI-0028`    P1         §461      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M08 direct-card option and legal/payment review before use; M09 Core evidence in docs/milestones/M09.md

  `UI-0029`    P2         §461      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M08 direct-card option and legal/payment review before use; M09 Core evidence in docs/milestones/M09.md

  `UI-0030`    P2         §461      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M08 direct-card option and legal/payment review before use; M09 Core evidence in docs/milestones/M09.md

  `UI-0031`    P2         §461      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M08 direct-card option and legal/payment review before use; M09 Core evidence in docs/milestones/M09.md

  `PRD-0368`    P1         §462      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `PRD-0369`    P2         §462      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0064`    P1         §463      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0065`    P1         §463      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `JOB-0223`    P1         §464      `DEFERRED_VERIFICATION`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 component evidence; full gate OPEN; backlog:JOB-0223 M10 component: apps/web/src/marketplace,apps/web/app/discover,apps/web/app/buyer; tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts; full gate OPEN.

  `JOB-0224`    P1         §464      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M10 job page; M09 Core evidence in docs/milestones/M09.md

  `JOB-0225`    P1         §465      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M10 buyer job page; M09 Core evidence in docs/milestones/M09.md

  `JOB-0226`    P1         §466      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `JOB-0227`    P1         §466      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `PRD-0370`    P1         §467      `DEFERRED_VERIFICATION`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 component evidence; full gate OPEN; backlog:PRD-0370 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `PRD-0371`    P2         §467      `DEFERRED_VERIFICATION`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 component evidence; full gate OPEN; backlog:PRD-0371 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `PRD-0372`    P1         §468      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `PRD-0373`    P2         §468      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0066`    P1         §469      `DEFERRED_VERIFICATION`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 component evidence; full gate OPEN; backlog:AVL-0066 M10 component: apps/web/src/marketplace,apps/web/app/discover,apps/web/app/buyer; tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts; full gate OPEN.

  `PRD-0374`    P1         §470      `OPEN_IMPLEMENTATION`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts,apps/web/app/buyer   tests/m09-postgres-integration.mjs,tests/m10-postgres-integration.mjs   M16 review: bounded expiry and credit release exist, but §470 buyer notification is missing production behavior owned by M29; retain OPEN_IMPLEMENTATION until durable delivery and restart E2E exist.

  `PRD-0375`    P2         §470      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `JOB-0228`    P1         §471      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `JOB-0229`    P1         §471      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `JOB-0230`    P1         §471      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0067`    P1         §472      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0068`    P1         §472      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0069`    P1         §472      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `JOB-0231`    P1         §473      `DEFERRED_VERIFICATION`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 component evidence; full gate OPEN; backlog:JOB-0231 M10 component: apps/web/src/marketplace,apps/web/app/discover,apps/web/app/buyer; tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts; full gate OPEN.

  `CAP-0114`    P1         §474      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `AVL-0070`    P1         §475      `VERIFIED`   packages/persistence/src/availability.ts,packages/persistence/src/marketplace-buyer.ts,apps/web/app/capabilities/[slug]/run-form.tsx   tests/m09-postgres-integration.mjs,tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts,docs/evidence/m16-schedule-quote-expiry.md   Immutable quote TTL, schedule/version/price/health/capacity and payment limits are revalidated server-side; stale browser confirmation creates no reservation and requires a fresh quote.

  `AVL-0071`    P1         §475      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `PRD-0376`    P1         §476      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M10 buyer locale UI; M09 Core evidence in docs/milestones/M09.md

  `AVL-0072`    P1         §477      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M10 marketplace cards; M09 Core evidence in docs/milestones/M09.md

  `AVL-0073`    P1         §478      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M10 capability detail; M09 Core evidence in docs/milestones/M09.md

  `PRD-0377`    P1         §479      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M11 Marketplace Agent; M09 Core evidence in docs/milestones/M09.md

  `PRD-0378`    P2         §479      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M11 Marketplace Agent; M09 Core evidence in docs/milestones/M09.md

  `AGT-0098`    P1         §480      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M11 Agent orchestration; M09 Core evidence in docs/milestones/M09.md

  `AGT-0099`    P1         §480      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M11 Agent orchestration; M09 Core evidence in docs/milestones/M09.md

  `AGT-0100`    P1         §480      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M11 Agent orchestration; M09 Core evidence in docs/milestones/M09.md

  `AGT-0101`    P1         §480      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `JOB-0232`    P1         §481      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M13 REST API; M09 Core evidence in docs/milestones/M09.md

  `JOB-0233`    P1         §481      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M13 REST API; M09 Core evidence in docs/milestones/M09.md

  `JOB-0234`    P1         §481      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M13 REST API; M09 Core evidence in docs/milestones/M09.md

  `JOB-0235`    P1         §482      `DEFERRED_VERIFICATION`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 component evidence; full gate OPEN; backlog:JOB-0235

  `JOB-0236`    P1         §483      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M10 buyer notices and M13 notification delivery; M09 Core evidence in docs/milestones/M09.md

  `JOB-0237`    P1         §483      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M10 buyer notices and M13 notification delivery; M09 Core evidence in docs/milestones/M09.md

  `JOB-0238`    P1         §483      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M10 buyer notices and M13 notification delivery; M09 Core evidence in docs/milestones/M09.md

  `JOB-0239`    P1         §483      `TODO`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   OPEN later-owned implementation: M10 buyer notices and M13 notification delivery; M09 Core evidence in docs/milestones/M09.md

  `PRD-0379`    P1         §484      `OPEN_IMPLEMENTATION`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 component evidence; full gate OPEN; backlog:PRD-0379

  `PRD-0380`    P2         §484      `OPEN_IMPLEMENTATION`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 component evidence; full gate OPEN; backlog:PRD-0380

  `PRD-0381`    P2         §484      `OPEN_IMPLEMENTATION`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 component evidence; full gate OPEN; backlog:PRD-0381

  `JOB-0240`    P1         §485      `OPEN_IMPLEMENTATION`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 component evidence; full gate OPEN; backlog:JOB-0240

  `JOB-0241`    P1         §486      `DEFERRED_VERIFICATION`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 component evidence; full gate OPEN; backlog:JOB-0241 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `JOB-0242`    P1         §486      `DEFERRED_VERIFICATION`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 component evidence; full gate OPEN; backlog:JOB-0242 M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; full cross-system closing test remains OPEN.

  `JOB-0243`    P1         §486      `VERIFIED`   packages/contracts/src/availability.ts,packages/persistence/src/availability.ts   tests/m09-postgres-integration.mjs   M09 Core verified; docs/milestones/M09.md

  `PRD-0382`    P1         §487      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts,tests/m09-postgres-integration.mjs   Schedule-closed capability remains discoverable and schedulable

  `PRD-0383`    P2         §487      `VERIFIED`   packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts,tests/m09-postgres-integration.mjs   Schedule-closed capability remains discoverable and schedulable

  `AVL-0074`    P1    §488    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/application/src/marketplace-agent-discovery.ts,apps/web/app/discover,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/m11-agent.test.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0075`    P1    §488    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/application/src/marketplace-agent-discovery.ts,apps/web/app/discover,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/m11-agent.test.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0076`    P1    §488    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/application/src/marketplace-agent-discovery.ts,apps/web/app/discover,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/m11-agent.test.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0384`    P1    §489    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/application/src/marketplace-agent-discovery.ts,apps/web/app/discover,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/m11-agent.test.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0385`    P2    §489    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/application/src/marketplace-agent-discovery.ts,apps/web/app/discover,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/m11-agent.test.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0386`    P2    §489    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/application/src/marketplace-agent-discovery.ts,apps/web/app/discover,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/m11-agent.test.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0387`    P2    §489    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/application/src/marketplace-agent-discovery.ts,apps/web/app/discover,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/m11-agent.test.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0388`    P1    §490    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/application/src/marketplace-agent-discovery.ts,apps/web/app/discover,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/m11-agent.test.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0389`    P2    §490    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/application/src/marketplace-agent-discovery.ts,apps/web/app/discover,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/m11-agent.test.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0390`    P2    §490    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/application/src/marketplace-agent-discovery.ts,apps/web/app/discover,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/m11-agent.test.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0391`    P2    §490    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/application/src/marketplace-agent-discovery.ts,apps/web/app/discover,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/m11-agent.test.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `CAP-0115`    P1    §491    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/application/src/marketplace-agent-discovery.ts,apps/web/app/discover,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/m11-agent.test.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `CAP-0116`    P1    §491    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/application/src/marketplace-agent-discovery.ts,apps/web/app/discover,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/m11-agent.test.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `CAP-0117`    P1    §491    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/application/src/marketplace-agent-discovery.ts,apps/web/app/discover,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/m11-agent.test.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `CAP-0118`    P1    §491    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/application/src/marketplace-agent-discovery.ts,apps/web/app/discover,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/m11-agent.test.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0077`    P1    §492    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/application/src/marketplace-agent-discovery.ts,apps/web/app/discover,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/m11-agent.test.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0078`    P1    §492    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/application/src/marketplace-agent-discovery.ts,apps/web/app/discover,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/m11-agent.test.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `JOB-0244`    P1    §493    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/application/src/marketplace-agent-discovery.ts,apps/web/app/discover,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/m11-agent.test.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `JOB-0245`    P1    §493    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/application/src/marketplace-agent-discovery.ts,apps/web/app/discover,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/m11-agent.test.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `JOB-0246`    P1    §493    `VERIFIED`   packages/persistence/src/marketplace-catalog.ts,packages/application/src/marketplace-agent-discovery.ts,apps/web/app/discover,apps/web/app/capabilities   tests/m10-postgres-integration.mjs,tests/m11-agent.test.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0392`    P1    §494    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0393`    P2    §494    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0079`    P1    §495    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0080`    P1    §495    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0081`    P1    §495    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0082`    P1    §496    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0083`    P1    §496    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `JOB-0247`    P1    §497    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `JOB-0248`    P1    §497    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `UI-0032`    P1    §498    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `UI-0033`    P2    §498    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `UI-0034`    P2    §498    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `UI-0035`    P2    §498    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `UI-0036`    P1    §499    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `UI-0037`    P2    §499    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `UI-0038`    P2    §499    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `UI-0039`    P2    §499    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0084`    P1    §500    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0085`    P1    §500    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0086`    P1    §500    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0394`    P1    §501    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0395`    P2    §501    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0087`    P1    §502    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0088`    P1    §502    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0089`    P1    §502    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0090`    P1    §503    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0091`    P1    §503    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0092`    P1    §503    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0093`    P1    §504    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0094`    P1    §504    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0095`    P1    §504    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0096`    P1    §504    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0396`    P1    §505    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0397`    P2    §505    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0398`    P2    §505    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `JOB-0249`    P1    §506    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `JOB-0250`    P1    §506    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `JOB-0251`    P1    §506    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `TST-0021`    P1    §507    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0097`    P1    §508    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0098`    P1    §508    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `CAP-0119`    P1    §509    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `CAP-0120`    P1    §509    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0099`    P1    §510    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0100`    P1    §510    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0101`    P1    §510    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0102`    P1    §510    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0399`    P1    §511    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0400`    P2    §511    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0102`    P1    §512    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AGT-0103`    P1    §512    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0401`    P1    §513    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0402`    P2    §513    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0403`    P1    §514    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0404`    P2    §514    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `JOB-0252`    P1    §515    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `JOB-0253`    P1    §515    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `JOB-0254`    P1    §515    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0103`    P1    §516    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0104`    P1    §516    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0105`    P1    §516    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0106`    P1    §516    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0107`    P1    §516    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0108`    P1    §516    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `AVL-0109`    P1    §516    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0405`    P1    §517    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0406`    P2    §517    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `PRD-0407`    P2    §517    `VERIFIED`   packages/application/src/marketplace-agent-discovery.ts,packages/application/src/marketplace-agent-planner.ts,packages/application/src/agent-purchase-authorization.ts,apps/web/app/ai-request   tests/m11-agent.test.mjs,tests/m11-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts   M11 Core/unit/PostgreSQL/browser evidence; docs/milestones/M11.md. Provider behavior is fixture-backed; live-provider gate remains separate where mapped.

  `UI-0040`     P1         §518     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0041`     P2         §518     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0042`     P2         §518     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0043`     P2         §518     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0044`     P1         §519     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0045`     P2         §519     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0046`     P2         §519     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0047`     P2         §519     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0048`     P2         §519     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0049`     P1         §520     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0050`     P2         §520     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0051`     P2         §520     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0052`     P2         §520     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0053`     P2         §520     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0054`     P1         §521     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0055`     P2         §521     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0056`     P2         §521     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0057`     P2         §521     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0058`     P1         §522     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0059`     P2         §522     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0060`     P2         §522     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0061`     P2         §522     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0062`     P2         §522     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0063`     P1         §523     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0064`     P2         §523     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0065`     P2         §523     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0066`     P2         §523     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0067`     P2         §523     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0068`     P1         §524     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0069`     P2         §524     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0070`     P1         §525     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0071`     P2         §525     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0072`     P2         §525     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `JOB-0255`    P1         §526     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `JOB-0256`    P1         §526     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `JOB-0257`    P1         §526     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `JOB-0258`    P1         §526     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0073`     P1         §527     `VERIFIED`   apps/web/app/discover/marketplace-ui.tsx,apps/web/app/design-system.css   tests/browser-m10/marketplace.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0074`     P2         §527     `VERIFIED`   apps/web/app/discover/marketplace-ui.tsx,apps/web/app/design-system.css   tests/browser-m10/marketplace.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `PRD-0408`    P1         §528     `VERIFIED`   apps/web/app/capabilities/[slug]/page.tsx,apps/web/app/design-system.css   tests/browser-m10/design-system.spec.ts,tests/browser-m10/marketplace.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `PRD-0409`    P2         §528     `VERIFIED`   apps/web/app/capabilities/[slug]/page.tsx,apps/web/app/design-system.css   tests/browser-m10/design-system.spec.ts,tests/browser-m10/marketplace.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `PRD-0410`    P2         §528     `VERIFIED`   apps/web/app/capabilities/[slug]/page.tsx,apps/web/app/design-system.css   tests/browser-m10/design-system.spec.ts,tests/browser-m10/marketplace.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `PRD-0411`    P1         §529     `VERIFIED`   apps/web/app/discover/page.tsx,apps/web/app/design-system.css   tests/browser-m10/marketplace.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `PRD-0412`    P2         §529     `VERIFIED`   apps/web/app/discover/page.tsx,apps/web/app/design-system.css   tests/browser-m10/marketplace.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `PRD-0413`    P2         §529     `VERIFIED`   apps/web/app/discover/page.tsx,apps/web/app/design-system.css   tests/browser-m10/marketplace.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `PRD-0414`    P2         §529     `VERIFIED`   apps/web/app/discover/page.tsx,apps/web/app/design-system.css   tests/browser-m10/marketplace.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `AGT-0104`    P1         §530     `VERIFIED`   apps/web/app/ai-request/agent-panel.tsx,apps/web/app/design-system.css   tests/browser-m10/marketplace.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `AGT-0105`    P1         §530     `VERIFIED`   apps/web/app/ai-request/agent-panel.tsx,apps/web/app/design-system.css   tests/browser-m10/marketplace.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `AGT-0106`    P1         §530     `VERIFIED`   apps/web/app/ai-request/agent-panel.tsx,apps/web/app/design-system.css   tests/browser-m10/marketplace.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `JOB-0259`    P1         §531     `VERIFIED`   apps/web/app/seller/operations-dashboard.tsx,apps/web/app/design-system.css   tests/browser-m12/seller-operations.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `JOB-0260`    P1         §531     `VERIFIED`   apps/web/app/seller/operations-dashboard.tsx,apps/web/app/design-system.css   tests/browser-m12/seller-operations.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `JOB-0261`    P1         §531     `VERIFIED`   apps/web/app/seller/operations-dashboard.tsx,apps/web/app/design-system.css   tests/browser-m12/seller-operations.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `SEC-0119`    P1         §532     `VERIFIED` apps/web/app/capabilities/[slug]/page.tsx,apps/web/app/seller/seller-publication.tsx,apps/web/app/ui/permission-copy.ts   tests/m16-installed-worker-e2e.mjs,tests/m06-postgres-integration.mjs,docs/evidence/m16-authentic-browser-review.md   Full §532 review: exact Worker-reviewed seller/buyer manifest parity, keyboard disclosure, plain-language labels, published read-only database permission and absent-permission comparison pass at desktop/mobile.

  `SEC-0120`    P0         §532     `VERIFIED` apps/web/app/capabilities/[slug]/page.tsx,apps/web/app/seller/seller-publication.tsx,apps/web/app/ui/permission-copy.ts   tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-authentic-browser-review.md   Authentic Worker-reviewed seller and buyer disclosures use the same plain-language manifest labels; keyboard and desktop/mobile visual checks passed.

  `SEC-0121`    P0         §532     `VERIFIED` apps/web/app/capabilities/[slug]/page.tsx,apps/web/app/seller/seller-publication.tsx,apps/web/app/ui/permission-copy.ts   tests/m06-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-browser/m16-public-database-mobile.png   Real Docker/OpenClaw read-only DB broker package was Worker-reviewed, seller-approved and published; buyer/seller labels match `READ_ONLY`, while the no-DB document version displays `Not used`.

  `UI-0075`     P1         §533     `VERIFIED`   apps/web/app/discover/marketplace-ui.tsx,apps/web/app/seller/operations-dashboard.tsx   tests/browser-m10/marketplace.spec.ts,tests/browser-m12/seller-operations.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0076`     P2         §533     `VERIFIED`   apps/web/app/discover/marketplace-ui.tsx,apps/web/app/seller/operations-dashboard.tsx   tests/browser-m10/marketplace.spec.ts,tests/browser-m12/seller-operations.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `CAP-0121`    P1         §534     `VERIFIED`   apps/web/app/discover/marketplace-ui.tsx,apps/web/app/buyer/page.tsx,apps/web/app/seller/operations-dashboard.tsx   tests/browser-m10/marketplace.spec.ts,tests/browser-m12/seller-operations.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `CAP-0122`    P1         §534     `VERIFIED`   apps/web/app/discover/marketplace-ui.tsx,apps/web/app/buyer/page.tsx,apps/web/app/seller/operations-dashboard.tsx   tests/browser-m10/marketplace.spec.ts,tests/browser-m12/seller-operations.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `CAP-0123`    P1         §534     `VERIFIED`   apps/web/app/discover/marketplace-ui.tsx,apps/web/app/buyer/page.tsx,apps/web/app/seller/operations-dashboard.tsx   tests/browser-m10/marketplace.spec.ts,tests/browser-m12/seller-operations.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `PRD-0415`    P1         §535     `VERIFIED`   apps/web/app/discover,apps/web/app/capabilities,apps/web/app/seller   tests/browser-m10/design-system.spec.ts,tests/browser-m12/seller-operations.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `PRD-0416`    P2         §535     `VERIFIED`   apps/web/app/discover,apps/web/app/capabilities,apps/web/app/seller   tests/browser-m10/design-system.spec.ts,tests/browser-m12/seller-operations.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `PRD-0417`    P2         §535     `VERIFIED`   apps/web/app/discover,apps/web/app/capabilities,apps/web/app/seller   tests/browser-m10/design-system.spec.ts,tests/browser-m12/seller-operations.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `PRD-0418`    P2         §535     `VERIFIED`   apps/web/app/discover,apps/web/app/capabilities,apps/web/app/seller   tests/browser-m10/design-system.spec.ts,tests/browser-m12/seller-operations.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `JOB-0262`    P1         §536     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `JOB-0263`    P1         §536     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `JOB-0264`    P1         §536     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `JOB-0265`    P1         §537     `VERIFIED`   apps/web/app/capabilities/[slug]/run-form.tsx,apps/web/app/ai-request/agent-panel.tsx   tests/browser-m10/marketplace.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `JOB-0266`    P1         §537     `VERIFIED`   apps/web/app/capabilities/[slug]/run-form.tsx,apps/web/app/ai-request/agent-panel.tsx   tests/browser-m10/marketplace.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `PRD-0419`    P1         §538     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `PRD-0420`    P2         §538     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `PRD-0421`    P2         §538     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `PRD-0422`    P2         §538     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0077`     P1         §539     `VERIFIED`   apps/web/app/design-system.css,apps/web/app/sign-in/auth-panel.tsx,apps/web/app/capabilities/[slug]/run-form.tsx,apps/web/app/seller/page.tsx,apps/web/app/seller/seller-publication.tsx   tests/browser-m10/design-system.spec.ts,tests/browser-m10/marketplace.spec.ts,tests/browser-m12/seller-operations.spec.ts,tests/browser-m13/buyer-integrations.spec.ts,tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-accessibility.md   M16 rendered desktop/mobile WCAG A/AA axe checks cover public, buyer, seller, account error, critical security alert, real paid BUSY/queued/running/completed/failed states; keyboard focus, accessible names/status, associated form errors, contrast, touch targets, overflow and reduced motion are asserted.

  `PAY-0111`    P1         §540     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `PAY-0112`    P0         §540     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0078`     P1         §541     `TESTED`      docs/design-system.md,apps/web/app/design-system.css,apps/web/app/ui/kivro-icon.tsx   tests/browser-m10/design-system.spec.ts   D: The current documented design system and rendered product identity have evidence, but the §541 before-many-pages timing cannot be proven retroactively. Preserve the historical limitation; do not claim the earlier sequence occurred.

  `UI-0079`     P2         §541     `TESTED`      docs/design-system.md,apps/web/app/design-system.css,apps/web/app/ui/kivro-icon.tsx   tests/browser-m10/design-system.spec.ts   D: The design system exists now, but the explicit before-building-many-pages process requirement was not evidenced at that time and cannot be retroactively verified.

  `API-0028`    P1         §542     `VERIFIED`   apps/web/app/ui/kivro-icon.tsx,apps/web/app/discover/marketplace-ui.tsx   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `API-0029`    P1         §542     `VERIFIED`   apps/web/app/ui/kivro-icon.tsx,apps/web/app/discover/marketplace-ui.tsx   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0080`     P1         §543     `VERIFIED`   apps/web/app/ui/kivro-icon.tsx,apps/web/app/design-system.css   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0081`     P2         §543     `VERIFIED`   apps/web/app/ui/kivro-icon.tsx,apps/web/app/design-system.css   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `PRD-0423`    P1         §544     `VERIFIED`   apps/web/app/discover/page.tsx,tests/browser-m10/marketplace.spec.ts   tests/browser-m10/marketplace.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0082`     P1         §545     `TESTED`      docs/milestones/M14.md,tests/browser-m10/design-system.spec.ts   docs/milestones/M14.md   D: M14 rendered-screen review is evidenced; §545 requires a design review at each earlier user-facing milestone. Missing historical per-milestone review evidence cannot be manufactured retroactively.

  `UI-0083`     P2         §545     `TESTED`      docs/milestones/M14.md,tests/browser-m10/design-system.spec.ts   docs/milestones/M14.md   D: Current product design is reviewed, but the original instruction not to wait until the end is a historical process claim without contemporaneous evidence for every earlier user-facing milestone.

  `UI-0084`     P1         §546     `VERIFIED`   tests/browser-m10/design-system.spec.ts,tests/browser-m12/seller-operations.spec.ts   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0085`     P2         §546     `VERIFIED`   tests/browser-m10/design-system.spec.ts,tests/browser-m12/seller-operations.spec.ts   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0086`     P2         §546     `VERIFIED`   tests/browser-m10/design-system.spec.ts,tests/browser-m12/seller-operations.spec.ts   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0087`     P1         §547     `VERIFIED`    tests/browser-m10/design-system.spec.ts,tests/browser-m10/marketplace.spec.ts,tests/browser-m12/seller-operations.spec.ts   tests/browser-m10/design-system.spec.ts,tests/browser-m10/design-system.spec.ts-snapshots/,tests/browser-m10/marketplace.spec.ts,tests/browser-m12/seller-operations.spec.ts   A fixed: M14 previously captured screenshots without asserting regression. Four deterministic Playwright image baselines now compare home and Discover desktop/mobile; M10/M12/M13 capture the remaining core rendered states. pnpm test:browser:m10 passes against stored baselines.

  `UI-0088`     P2         §547     `VERIFIED`    tests/browser-m10/design-system.spec.ts,tests/browser-m10/marketplace.spec.ts,tests/browser-m12/seller-operations.spec.ts   tests/browser-m10/design-system.spec.ts,tests/browser-m10/design-system.spec.ts-snapshots/,tests/browser-m10/marketplace.spec.ts,tests/browser-m12/seller-operations.spec.ts   A fixed: Playwright now detects pixel regressions against four checked-in home/Discover desktop/mobile baselines; existing browser screenshots and assertions cover detail, checkout/scheduled, Agent plan, seller dashboard/Worker health and publishing where practical. pnpm test:browser:m10 passes against baselines.

  `UI-0089`     P1         §548     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0090`     P2         §548     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `PRD-0424`    P1         §549     `VERIFIED`   apps/web/app/design-system.css,docs/design-system.md   tests/browser-m10/design-system.spec.ts   M14 rendered desktop/mobile review; current authoritative product data and responsive states checked.

  `UI-0091`     P1         §550     `DEFERRED_VERIFICATION` docs/design-system.md,apps/web/app/design-system.css,apps/web/app/seller/seller-publication.tsx   tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-authentic-browser-review.md   Authentic 1280px/390px seller publish, buyer privacy/quote and paid result now pass visual review; whole-product §550 still needs the real failure/queued/offline and external-provider payment states reviewed together.

  `UI-0092`     P2         §550     `VERIFIED` docs/design-system.md,apps/web/app/design-system.css,apps/web/app/seller/seller-publication.tsx,apps/web/app/capabilities/[slug]/run-form.tsx   tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-authentic-browser-review.md   Product design was reviewed and corrected against authentic 1280px/390px seller publication, buyer quote, privacy and paid result screens; whole-section UI acceptance remains separate.

  `UI-0093`     P2         §550     `DEFERRED_VERIFICATION` docs/design-system.md,apps/web/app/design-system.css,apps/web/app/seller/seller-publication.tsx   tests/m16-installed-worker-e2e.mjs,docs/evidence/m16-authentic-browser-review.md   Authentic publish/quote/result states were reviewed at desktop/mobile; real queued/offline/failure states and Stripe-funded result need one final cross-state Core parity review.
  --------------------------------------------------------------------------------

## Local development environment

  Requirement     Priority   Status   Implementation   Tests   Notes
  --------------- ---------- -------- ---------------- ------- -------
  DEV-LOCAL-001   P1         TODO     ---              ---     §551
  DEV-LOCAL-002   P1         TODO     ---              ---     §552
  DEV-LOCAL-003   P1         TODO     ---              ---     §553
  DEV-LOCAL-004   P1         TODO     ---              ---     §555
  DEV-LOCAL-005   P1         TODO     ---              ---     §556
  DEV-LOCAL-006   P1         TODO     ---              ---     §557
  DEV-LOCAL-007   P0         TODO     ---              ---     §558
  DEV-LOCAL-008   P0         TODO     ---              ---     §558
  DEV-LOCAL-009   P1         TODO     ---              ---     §559
  DEV-LOCAL-010   P1         TODO     ---              ---     §560
  DEV-LOCAL-011   P1         TODO     ---              ---     §561
  DEV-LOCAL-012   P0         TODO     ---              ---     §561
  DEV-LOCAL-013   P1         TODO     ---              ---     §562
  DEV-LOCAL-014   P1         TODO     ---              ---     §563
  DEV-LOCAL-015   P1         TODO     ---              ---     §564
  DEV-LOCAL-016   P0         TODO     ---              ---     §564
  DEV-LOCAL-017   P1         TODO     ---              ---     §565
  DEV-LOCAL-018   P1         TODO     ---              ---     §566
  DEV-LOCAL-019   P0         TODO     ---              ---     §566
  DEV-LOCAL-020   P1         TODO     ---              ---     §567
  DEV-LOCAL-021   P2         TODO     ---              ---     §568
  DEV-LOCAL-022   P1         TODO     ---              ---     §569
  DEV-LOCAL-023   P1         TODO     ---              ---     §570
  DEV-LOCAL-024   P1         TODO     ---              ---     §570
  DEV-LOCAL-025   P1         TODO     ---              ---     §571
  DEV-LOCAL-026   P1         TODO     ---              ---     §571
  DEV-LOCAL-027   P0         TODO     ---              ---     §572
  DEV-LOCAL-028   P0         TODO     ---              ---     §572
  DEV-LOCAL-029   P1         TODO     ---              ---     §573

## Authentication

  Requirement   Priority   Status   Implementation   Tests   Notes
  ------------- ---------- -------- ---------------- ------- -------
  AUTH-001      P1         OPEN_IMPLEMENTATION   apps/web/src/auth/options.ts,apps/web/src/auth/server.ts   tests/auth-options.test.mjs,tests/auth-local-integration.mjs   §574 Local email flow passes; real Google callback absent backlog:AUTH-001
  AUTH-002      P1         DEFERRED_VERIFICATION   packages/persistence/migrations/0002_auth.sql,apps/web/src/auth/options.ts   tests/auth-options.test.mjs,tests/sql/m02_auth.sql   §574 Better Auth user ID maps to accounts.id; Google account linking E2E pending backlog:AUTH-002
  AUTH-003      P0         VERIFIED   apps/web/src/auth/options.ts,packages/persistence/src/finance.ts,packages/persistence/src/marketplace-buyer.ts,packages/persistence/src/buyer-api-keys.ts,packages/persistence/src/seller-profiles.ts,packages/persistence/src/seller-publication.ts   tests/auth-local-integration.mjs,tests/m13-postgres-integration.mjs,docs/evidence/m16-email-verification-review.md   §575 Unverified email has no product session; Core denies credit purchase, paid job, API-key creation/use, seller profile/publication and Connect onboarding. PostgreSQL regression passed 2026-10-07.
  AUTH-004      P0         VERIFIED   apps/web/src/auth/password.ts,apps/web/src/auth/options.ts,packages/persistence/migrations/0002_auth.sql   tests/auth-password.test.mjs,tests/auth-local-integration.mjs,tests/browser/auth-email.spec.ts   §575 New credentials use pinned Argon2id v19 m=65536 t=3 p=1 with per-password salt; PostgreSQL stores only hash
  AUTH-005      P0         VERIFIED   apps/web/src/auth/verification-tokens.ts,apps/web/src/auth/handler.ts,packages/persistence/migrations/0006_auth_verification_one_use.sql   tests/auth-local-integration.mjs,tests/browser/auth-email.spec.ts   §575 Signed verification token is purpose-bound, one-use and expiring; local PostgreSQL/Mailpit test rejects reuse, expiry and a reset token at the verification boundary
  AUTH-006      P1         VERIFIED   apps/web/src/auth/options.ts,apps/web/app/sign-in/auth-panel.tsx   tests/auth-options.test.mjs,tests/auth-local-integration.mjs,tests/browser/auth-email.spec.ts   §575 PostgreSQL-backed sixth resend returns 429 after five allowed requests; browser sees verification guidance and can resend
  AUTH-007      P0         VERIFIED   apps/web/src/auth/options.ts,apps/web/app/sign-in/auth-panel.tsx,apps/web/app/reset-password/reset-panel.tsx   tests/auth-local-integration.mjs,tests/browser/auth-email.spec.ts   §575 Known/unknown reset and resend public responses match; duplicate signup has same status/no cookie and no existence wording; UI stays generic
  AUTH-008      P1         DEFERRED_VERIFICATION   apps/web/src/auth/options.ts   tests/auth-options.test.mjs   §576 Google OIDC configured only when credentials exist; real callback pending backlog:AUTH-008
  AUTH-009      P0         VERIFIED   apps/web/src/auth/options.ts,apps/web/src/auth/request-guard.ts   tests/auth-options.test.mjs,tests/auth-request-guard.test.mjs,tests/auth-local-integration.mjs   §576 Generated Google authorization URL has exactly openid/email/profile; client scope escalation denied and include-granted-scopes absent
  AUTH-010      P0         DEFERRED_VERIFICATION   packages/domain/src/identity-linking.ts   tests/identity-linking.test.mjs   §576 Verified-claim policy; OIDC token validation absent backlog:AUTH-010
  AUTH-011      P0         DEFERRED_VERIFICATION   packages/domain/src/identity-linking.ts   tests/identity-linking.test.mjs   §577 Same-email linking decision; DB transaction absent backlog:AUTH-011
  AUTH-012      P0         DEFERRED_VERIFICATION   packages/domain/src/identity-linking.ts   tests/identity-linking.test.mjs   §577 Unverified claim denied; full takeover testing absent backlog:AUTH-012
  AUTH-013      P1         DEFERRED_VERIFICATION   packages/persistence/migrations/0001_foundation.sql,packages/persistence/migrations/0002_auth.sql   tests/sql/m02_auth.sql   §577 Provider subject uniqueness persists; real Google link pending backlog:AUTH-013
  AUTH-014      P2         VERIFIED   apps/web/app/reset-password/reset-panel.tsx,apps/web/src/auth/options.ts,apps/web/src/auth/outbox.ts   tests/auth-local-integration.mjs   §577 Product policy enabled in DEC-IMPL-004; explicit expiring email-token flow adds credential identity to seeded verified Google-origin account without a duplicate account
  AUTH-015      P1         VERIFIED   apps/web/app/sign-in/auth-panel.tsx,apps/web/app/reset-password/reset-panel.tsx   docs/test-evidence/m02-auth-browser.md,tests/browser/auth-email.spec.ts,Next build   §578 Conventional sign-in with email/password and Continue with Google control; desktop/mobile visual review and Chrome email flow pass
  AUTH-016      P1         OPEN_IMPLEMENTATION   apps/web/app/sign-in/auth-panel.tsx,apps/web/app/reset-password/reset-panel.tsx   docs/test-evidence/m02-auth-browser.md   §578 Generic invalid/recovery, verify guidance/resend, Google failure UI present; expiry/account-link states and automated browser matrix pending backlog:AUTH-016
  AUTH-017      P0         DEFERRED_VERIFICATION   apps/web/src/auth/options.ts,apps/web/src/auth/request-guard.ts   tests/auth-options.test.mjs,tests/auth-request-guard.test.mjs   §579 Database rate limits and OAuth input guard present; broader attack suite pending backlog:AUTH-017
  AUTH-018      P0         DEFERRED_VERIFICATION   apps/web/src/auth/options.ts,apps/web/src/auth/audit.ts   tests/auth-options.test.mjs,tests/auth-audit.test.mjs   §579 HTTPS secure-cookie setting and disabled upstream PII logger; hosted cookie/logging proof pending backlog:AUTH-018
  AUTH-019      P1         VERIFIED   apps/web/src/auth/outbox.ts,apps/web/src/auth/options.ts,apps/web/app/reset-password/reset-panel.tsx   tests/auth-local-integration.mjs,tests/browser/auth-email.spec.ts   §579 First-party reset uses expiring single-purpose token; local PostgreSQL/Mailpit test rejects expired/reused token and preserves current password
  AUTH-020      P1         DEFERRED_VERIFICATION   packages/persistence/migrations/0007_auth_audit.sql,apps/web/src/auth/audit.ts,apps/web/src/auth/handler.ts   tests/auth-audit.test.mjs,tests/sql/m02_auth.sql,tests/auth-local-integration.mjs   §579 Transactional account/session audit and sanitized route outcomes pass; retention and full event matrix pending backlog:AUTH-020
  AUTH-021      P0         VERIFIED   apps/web/src/auth/server.ts,apps/web/src/auth/options.ts   tests/auth-options.test.mjs   §579 Production startup fails with missing Google credentials; required secrets have no development fallback, and insecure public HTTP origins are rejected
  AUTH-022      P1         VERIFIED   compose.local.yaml,apps/web/src/auth/outbox.ts,apps/web/src/auth/smtp-transport.ts   tests/auth-local-integration.mjs,tests/browser/auth-email.spec.ts   §580 Real local verification-token generation/delivery/consumption passes through PostgreSQL, Mailpit and Chrome
  AUTH-023      P1         DEFERRED_VERIFICATION   README.md   ---   §580 Local Google redirect documented; real non-production callback acceptance pending backlog:AUTH-023
  AUTH-024      P1         DEFERRED_VERIFICATION   apps/web/app/,apps/web/src/auth/   tests/browser/auth-email.spec.ts,tests/auth-local-integration.mjs   §580 Automated email registration/verification/login/reset/logout and one-use links pass; Google/linking/full failure matrix pending backlog:AUTH-024

## Netsons production profile

  Requirement    Priority   Status   Implementation   Tests   Notes
  -------------- ---------- -------- ---------------- ------- -------
  HOST-NET-001   P0         TODO     ---              ---     §581
  HOST-NET-002   P0         TODO     ---              ---     §582
  HOST-NET-003   P1         TODO     ---              ---     §583
  HOST-NET-004   P1         TODO     ---              ---     §583
  HOST-NET-005   P1         TODO     ---              ---     §584
  HOST-NET-006   P0         TODO     ---              ---     §585
  HOST-NET-007   P1         TODO     ---              ---     §585
  HOST-NET-008   P0         TODO     ---              ---     §586
  HOST-NET-009   P0         TODO     ---              ---     §587
  HOST-NET-010   P0         TODO     ---              ---     §588
  HOST-NET-011   P0         TODO     ---              ---     §589
  HOST-NET-012   P0         TODO     ---              ---     §589
  HOST-NET-013   P1         TODO     ---              ---     §590
  HOST-NET-014   P0         TODO     ---              ---     §591
  HOST-NET-015   P1         TODO     ---              ---     §592
  HOST-NET-016   P1         TODO     ---              ---     §593
  HOST-NET-017   P1         TODO     ---              ---     §594
  HOST-NET-018   P0         TODO     ---              ---     §595
  HOST-NET-019   P0         TODO     ---              ---     §596
  HOST-NET-020   P1         TODO     ---              ---     §597
  HOST-NET-021   P1         TODO     ---              ---     §598
  HOST-NET-022   P1         TODO     ---              ---     §598
  HOST-NET-023   P1         TODO     ---              ---     §599
  HOST-NET-024   P0         TODO     ---              ---     §600
  HOST-NET-025   P0         TODO     ---              ---     §601
  HOST-NET-026   P1         TODO     ---              ---     §602
  HOST-NET-027   P1         TODO     ---              ---     §603
  HOST-NET-028   P1         TODO     ---              ---     §604
  HOST-NET-029   P0         TODO     ---              ---     §605
  HOST-NET-030   P0         TODO     ---              ---     §606
  HOST-NET-031   P0         TODO     ---              ---     §607

## Backend portability and multi-control-plane continuity

  Requirement   Priority   Status   Implementation   Tests
  ------------- ---------- -------- ---------------- -------
  PORT-001      P0         TODO     ---              ---
  PORT-002      P0         TODO     ---              ---
  PORT-003      P0         TODO     ---              ---
  PORT-004      P0         TODO     ---              ---
  PORT-005      P0         TODO     ---              ---
  PORT-006      P0         TODO     ---              ---
  PORT-007      P0         TODO     ---              ---
  PORT-008      P0         TODO     ---              ---
  PORT-009      P0         TODO     ---              ---
  PORT-010      P0         TODO     ---              ---
  PORT-011      P1         TODO     ---              ---
  PORT-012      P0         TODO     ---              ---
  PORT-013      P0         TODO     ---              ---
  PORT-014      P1         TODO     ---              ---
  PORT-015      P0         TODO     ---              ---
  PORT-016      P0         TODO     ---              ---
  PORT-017      P1         TODO     ---              ---
  PORT-018      P0         TODO     ---              ---

## Transport-independent Worker connectivity

  Requirement   Priority   Status   Implementation   Tests
  ------------- ---------- -------- ---------------- -------
  PORT-019      P0         TODO     ---              ---
  PORT-020      P0         TODO     ---              ---
  PORT-021      P0         TODO     ---              ---
  PORT-022      P0         TODO     ---              ---
  PORT-023      P0         TODO     ---              ---
  PORT-024      P0         TODO     ---              ---
  PORT-025      P0         TODO     ---              ---
  PORT-026      P0         TODO     ---              ---
  PORT-027      P1         TODO     ---              ---
  PORT-028      P0         TODO     ---              ---
  PORT-029      P0         TODO     ---              ---
  PORT-030      P1         TODO     ---              ---

## Unified monorepo / dual deployment profile coverage

  -----------------------------------------------------------------------
  Requirement    Priority    Status      Implementation   Test evidence
                                         evidence         
  -------------- ----------- ----------- ---------------- ---------------
  ARCH-UNI-001   P0          IN_PROGRESS packages/        tests/architecture.test.mjs

  ARCH-UNI-002   P0          IN_PROGRESS apps/cloud-*/    tests/architecture.test.mjs

  ARCH-UNI-003   P0          TODO        ---              ---

  ARCH-UNI-004   P0          IN_PROGRESS tools/architecture.mjs tests/architecture.test.mjs

  ARCH-UNI-005   P0          IN_PROGRESS packages/infrastructure/contracts/src/ports.ts --- no adapters yet

  ARCH-UNI-006   P0          IN_PROGRESS apps/cloud-*/,packages/infrastructure/ tests/architecture.test.mjs profiles not runnable

  ARCH-UNI-007   P0          TODO        ---              ---

  ARCH-UNI-008   P0          TODO        ---              ---

  ARCH-UNI-009   P0          TODO        ---              ---

  ARCH-UNI-010   P0          TODO        ---              ---

  ARCH-UNI-011   P0          TODO        ---              ---

  ARCH-UNI-012   P0          TODO        ---              ---

  ARCH-UNI-013   P0          TODO        ---              ---

  ARCH-UNI-014   P0          TODO        ---              ---

  ARCH-UNI-015   P0          IN_PROGRESS tools/architecture.mjs tests/architecture.test.mjs local gate only

  ARCH-UNI-016   P1          TODO        ---              ---

  ARCH-UNI-017   P0          TODO        ---              ---

  ARCH-UNI-018   P0          TODO        ---              ---

  ARCH-UNI-019   P0          TODO        ---              ---

  ARCH-UNI-020   P0          TODO        ---              ---

  ARCH-UNI-021   P0          TODO        ---              ---

  ARCH-UNI-022   P0          TODO        ---              ---

  ARCH-UNI-023   P0          TODO        ---              ---

  ARCH-UNI-024   P0          TODO        ---              ---
  -----------------------------------------------------------------------

## Engineering hardening coverage

  ------------------------------------------------------------------------
  Requirement   Priority     Status       Implementation   Test evidence
                                          evidence         
  ------------- ------------ ------------ ---------------- ---------------
  HARD-001      P0           TODO         ---              ---

  HARD-002      P0           TODO         ---              ---

  HARD-003      P0           TODO         ---              ---

  HARD-004      P0           TODO         ---              ---

  HARD-005      P0           TODO         ---              ---

  HARD-006      P0           TODO         ---              ---

  HARD-007      P0           TODO         ---              ---

  HARD-008      P0           TODO         ---              ---

  HARD-009      P0           TODO         ---              ---

  HARD-010      P0           TODO         ---              ---

  HARD-011      P0           TODO         ---              ---

  HARD-012      P1           TODO         ---              ---

  HARD-013      P0           TODO         ---              ---

  HARD-014      P0           TODO         ---              ---

  HARD-015      P0           TODO         ---              ---

  HARD-016      P0           TODO         ---              ---

  HARD-017      P0           TODO         ---              ---

  HARD-018      P0           TODO         ---              ---

  HARD-019      P1           TODO         ---              ---

  HARD-020      P1           TODO         ---              ---

  HARD-021      P0           TODO         ---              ---

  HARD-022      P0           TODO         ---              ---

  HARD-023      P0           TODO         ---              ---

  HARD-024      P0           TODO         ---              ---

  HARD-025      P0           TODO         ---              ---

  HARD-026      P0           TODO         ---              ---

  HARD-027      P0           TODO         ---              ---

  HARD-028      P1           TODO         ---              ---
  ------------------------------------------------------------------------

## Durable asynchronous job/result coverage

  -----------------------------------------------------------------------------
  Requirement   Priority   Status   Shared     Netsons    AWS        Test
                                    evidence   evidence   evidence   evidence
  ------------- ---------- -------- ---------- ---------- ---------- ----------
  ASYNC-001     P0         TODO     ---        ---        ---        ---

  ASYNC-002     P0         TODO     ---        ---        ---        ---

  ASYNC-003     P0         TODO     ---        ---        ---        ---

  ASYNC-004     P0         TODO     ---        ---        ---        ---

  ASYNC-005     P0         TODO     ---        ---        ---        ---

  ASYNC-006     P0         TODO     ---        ---        ---        ---

  ASYNC-007     P0         TODO     ---        ---        ---        ---

  ASYNC-008     P0         TODO     ---        ---        ---        ---

  ASYNC-009     P0         TODO     ---        ---        ---        ---

  ASYNC-010     P0         TODO     ---        ---        ---        ---

  ASYNC-011     P0         TODO     ---        ---        ---        ---

  ASYNC-012     P0         TODO     ---        ---        ---        ---

  ASYNC-013     P0         TODO     ---        ---        ---        ---

  ASYNC-014     P0         TODO     ---        ---        ---        ---

  ASYNC-015     P0         TODO     ---        ---        ---        ---

  ASYNC-016     P0         TODO     ---        ---        ---        ---

  ASYNC-017     P0         TODO     ---        ---        ---        ---

  ASYNC-018     P1         TODO     ---        ---        ---        ---

  ASYNC-019     P0         TODO     ---        ---        ---        ---

  ASYNC-020     P1         TODO     ---        ---        ---        ---

  ASYNC-021     P0         TODO     ---        ---        ---        ---

  ASYNC-022     P0         TODO     ---        ---        ---        ---

  ASYNC-023     P0         TODO     ---        ---        ---        ---

  ASYNC-024     P0         TODO     ---        ---        ---        ---

  ASYNC-025     P0         TODO     ---        ---        ---        ---

  ASYNC-026     P0         VERIFIED   packages/persistence/src/job-execution.ts,apps/worker/src/result-outbox.ts,apps/worker/src/execution-runtime.ts   tests/m07-result-postgres-integration.mjs,tests/m16-installed-worker-e2e.mjs   The installed Worker loses a cloud finalization acknowledgement after commit, restarts/reconnects, replays its durable outbox, then deliberately repeats the signed finalization RPC; exactly one immutable result manifest and one settlement journal remain. Stripe funding and provider cutover are separate acceptance gates.

  ASYNC-027     P0         TODO     ---        ---        ---        ---

  ASYNC-028     P0         TODO     ---        ---        ---        ---

  ASYNC-029     P0         TODO     ---        ---        ---        ---

  ASYNC-030     P0         TODO     ---        ---        ---        ---
  -----------------------------------------------------------------------------

`ASYNC-026` now has the previously missing installed Worker evidence: the
development-credit paid Docker/OpenClaw path injects a lost finalization ACK
after PostgreSQL commits, restarts the Worker, reconnects to its owner plane,
replays the durable outbox and repeats the signed completion RPC. The test
asserts one result manifest and one financial settlement. Its original
idempotent-finalization requirement does not itself demand Stripe funding or
two deployment profiles; those separate release/conformance gates remain open.

## Buyer experience coverage

  ------------------------------------------------------------------------------
  Requirement   Priority   Status    Shared     Netsons    AWS        UX/E2E
                                     evidence   evidence   evidence   evidence
  ------------- ---------- --------- ---------- ---------- ---------- ----------
  BUYERUX-001   P0         TODO      ---        ---        ---        ---

  BUYERUX-002   P0         TODO      ---        ---        ---        ---

  BUYERUX-003   P0         TODO      ---        ---        ---        ---

  BUYERUX-004   P0         TODO      ---        ---        ---        ---

  BUYERUX-005   P0         TODO      ---        ---        ---        ---

  BUYERUX-006   P0         TODO      ---        ---        ---        ---

  BUYERUX-007   P0         TODO      ---        ---        ---        ---

  BUYERUX-008   P0         TODO      ---        ---        ---        ---

  BUYERUX-009   P1         TODO      ---        ---        ---        ---

  BUYERUX-010   P0         TODO      ---        ---        ---        ---

  BUYERUX-011   P1         TODO      ---        ---        ---        ---

  BUYERUX-012   P0         TODO      ---        ---        ---        ---

  BUYERUX-013   P1         TODO      ---        ---        ---        ---

  BUYERUX-014   P0         TODO      ---        ---        ---        ---

  BUYERUX-015   P1         TODO      ---        ---        ---        ---

  BUYERUX-016   P1         TODO      ---        ---        ---        ---

  BUYERUX-017   P0         TODO      ---        ---        ---        ---

  BUYERUX-018   P0         TODO      ---        ---        ---        ---

  BUYERUX-019   P1         TODO      ---        ---        ---        ---

  BUYERUX-020   P0         TODO      ---        ---        ---        ---

  BUYERUX-021   P1         TODO      ---        ---        ---        ---

  BUYERUX-022   P0         TODO      ---        ---        ---        ---

  BUYERUX-023   P0         TODO      ---        ---        ---        ---

  BUYERUX-024   P0         TODO      ---        ---        ---        ---

  BUYERUX-025   P0         TODO      ---        ---        ---        ---

  BUYERUX-026   P0         TODO      ---        ---        ---        ---

  BUYERUX-027   P0         TODO      ---        ---        ---        ---

  BUYERUX-028   P0         TODO      ---        ---        ---        ---

  BUYERUX-029   P1         TODO      ---        ---        ---        ---

  BUYERUX-030   P0         TODO      ---        ---        ---        ---

  BUYERUX-031   P0         TODO      ---        ---        ---        ---

  BUYERUX-032   P1         TODO      ---        ---        ---        ---

  BUYERUX-033   P1         TODO      ---        ---        ---        ---

  BUYERUX-034   P0         TODO      ---        ---        ---        ---

  BUYERUX-035   P0         TODO      ---        ---        ---        ---

  BUYERUX-036   P0         TODO      ---        ---        ---        ---

  BUYERUX-037   P0         TODO      ---        ---        ---        ---

  BUYERUX-038   P0         TODO      ---        ---        ---        ---

  BUYERUX-039   P0         TODO      ---        ---        ---        ---

  BUYERUX-040   P0         TODO      ---        ---        ---        ---

  BUYERUX-041   P1         TODO      ---        ---        ---        ---

  BUYERUX-042   P0         TODO      ---        ---        ---        ---

  BUYERUX-043   P0         TODO      ---        ---        ---        ---

  BUYERUX-044   P0         TODO      ---        ---        ---        ---

  BUYERUX-045   P0         TODO      ---        ---        ---        ---
  ------------------------------------------------------------------------------

## Seller experience coverage

  --------------------------------------------------------------------------------
  Requirement    Priority   Status     Shared     Netsons    AWS        UX/E2E
                                       evidence   evidence   evidence   evidence
  -------------- ---------- ---------- ---------- ---------- ---------- ----------
  SELLERUX-001   P0         TODO       ---        ---        ---        ---

  SELLERUX-002   P0         TODO       ---        ---        ---        ---

  SELLERUX-003   P0         TODO       ---        ---        ---        ---

  SELLERUX-004   P1         TODO       ---        ---        ---        ---

  SELLERUX-005   P0         TODO       ---        ---        ---        ---

  SELLERUX-006   P0         TODO       ---        ---        ---        ---

  SELLERUX-007   P1         TODO       ---        ---        ---        ---

  SELLERUX-008   P0         TODO       ---        ---        ---        ---

  SELLERUX-009   P0         TODO       ---        ---        ---        ---

  SELLERUX-010   P0         TODO       ---        ---        ---        ---

  SELLERUX-011   P0         TODO       ---        ---        ---        ---

  SELLERUX-012   P0         TODO       ---        ---        ---        ---

  SELLERUX-013   P0         TODO       ---        ---        ---        ---

  SELLERUX-014   P0         TODO       ---        ---        ---        ---

  SELLERUX-015   P1         TODO       ---        ---        ---        ---

  SELLERUX-016   P0         TODO       ---        ---        ---        ---

  SELLERUX-017   P0         TODO       ---        ---        ---        ---

  SELLERUX-018   P0         TODO       ---        ---        ---        ---

  SELLERUX-019   P1         TODO       ---        ---        ---        ---

  SELLERUX-020   P0         TODO       ---        ---        ---        ---

  SELLERUX-021   P1         TODO       ---        ---        ---        ---

  SELLERUX-022   P0         TODO       ---        ---        ---        ---

  SELLERUX-023   P0         TODO       ---        ---        ---        ---

  SELLERUX-024   P0         TODO       ---        ---        ---        ---

  SELLERUX-025   P0         TODO       ---        ---        ---        ---

  SELLERUX-026   P0         TODO       ---        ---        ---        ---

  SELLERUX-027   P0         TODO       ---        ---        ---        ---

  SELLERUX-028   P1         TODO       ---        ---        ---        ---

  SELLERUX-029   P0         TODO       ---        ---        ---        ---

  SELLERUX-030   P0         TODO       ---        ---        ---        ---

  SELLERUX-031   P0         TODO       ---        ---        ---        ---

  SELLERUX-032   P0         TODO       ---        ---        ---        ---

  SELLERUX-033   P0         TODO       ---        ---        ---        ---

  SELLERUX-034   P0         TODO       ---        ---        ---        ---

  SELLERUX-035   P0         TODO       ---        ---        ---        ---

  SELLERUX-036   P0         TODO       ---        ---        ---        ---

  SELLERUX-037   P0         TODO       ---        ---        ---        ---

  SELLERUX-038   P1         TODO       ---        ---        ---        ---

  SELLERUX-039   P1         TODO       ---        ---        ---        ---

  SELLERUX-040   P1         TODO       ---        ---        ---        ---

  SELLERUX-041   P0         TODO       ---        ---        ---        ---
  --------------------------------------------------------------------------------
