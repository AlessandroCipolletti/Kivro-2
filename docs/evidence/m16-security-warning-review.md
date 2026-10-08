# M16 security-warning and automatic block review

Original Master Spec §§377–378 require first-class seller warnings with
severity, affected device/capability, detection time, a required action and a
blocking state. Critical security failure must stop new work automatically,
before the seller sees a warning.

- `packages/persistence/src/worker-heartbeat.ts` persists signed Worker
  operational checks and marks security-critical version, approved-image and
  sandbox self-test failures as durable `worker_security_blocks`. Cloud offer
  eligibility and seller resume use that block; the Worker has its own local
  fail-closed readiness and security-pause boundary.
- `tests/m12-postgres-integration.mjs` injects version, approved-image and
  isolation self-test failures into the production heartbeat repository. It
  asserts the cloud directive is security-paused before querying the seller
  dashboard; resume and maintenance expiry cannot override the block. It then
  checks the seller projection has CRITICAL severity, an affected Worker,
  detection time, action and blocking state, and that only a healthy recheck
  permits explicit platform clearance.
- `apps/worker/src/runtime-readiness.ts` marks a changed reviewed package,
  skill or approved runtime as requiring revalidation. The signed Worker
  heartbeat reports `DEPENDENCY_BLOCKED`; shared Core refuses new paid work
  and the seller projection raises the distinct blocking
  `CAPABILITY_REVALIDATION_REQUIRED` warning with a new-review action.
  `tests/worker-runtime-readiness.test.mjs`,
  `tests/availability-reporter.test.mjs` and the PostgreSQL
  `tests/m09-postgres-integration.mjs` exercise that chain.
- `tests/browser-m12/seller-operations.spec.ts` renders a persisted critical
  sandbox warning for the authenticated seller. It verifies a visible
  accessible alert containing CRITICAL, Blocking and a required action. It
  also renders the distinct capability revalidation warning. Both pass axe
  WCAG A/AA at 390 px. These controlled persisted states are UI
  rendering test, not a substitute for the signed heartbeat fault test.
- `tests/m16-installed-worker-e2e.mjs` and the Docker/OpenClaw boundary suite
  prove normal paid execution and fail-closed sandbox/runtime conditions on
  the installed local Worker. They do not claim a deployed incident exercise.

The current local Worker, PostgreSQL and browser evidence closes
`SEC-0111`–`SEC-0113`. Independent security assessment and deployed provider
parity remain separate mandatory gates.
