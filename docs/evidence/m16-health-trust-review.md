# M16 original §§76, 369–375 paid-path review

Reviewed against `spec/MASTER-SPEC.md` on 2026-10-07. This is local
development-credit evidence, not Stripe acceptance or an independent security
review.

## Buyer trust — PRD-0063–PRD-0065

The published capability page renders the immutable public permission manifest,
execution on the seller machine in a temporary per-job sandbox, private-network
restriction, buyer-file retention, external processors and a sensitive-input
warning. It makes no absolute isolation promise. The distinct authenticated
buyer in `tests/m16-installed-worker-e2e.mjs` compares every visible permission
category and state with the reviewed version, checks the disclosures, and then
runs that version through the installed Worker and real Docker/OpenClaw. Seller
host paths and personal OpenClaw sentinel bytes are absent from the buyer page
and result. The same test passes desktop/mobile accessibility assertions.

## Signed Worker health — OBS-0007–OBS-0010, WRK-0101–WRK-0102

`apps/worker/src/execution-runtime.ts` obtains real local Docker daemon,
approved-image, device-identity and active sandbox self-test results for every
signed polling heartbeat. `packages/persistence/src/worker-heartbeat.ts`
persists the signed checks and security blocks. The seller operations Core
projection calculates current state from heartbeat freshness, local/cloud
pause, security block, capability readiness and seven-day job outcomes; the
Web page renders that projection. The paid installed-Worker E2E checks the
latest signed heartbeat and exact rendered Worker release, Docker/image/self-
test status, recent heartbeat, job history and failure metrics at desktop and
mobile. M12 PostgreSQL tests cover offline, paused, healthy, not-ready and
security-warning states; Worker failure data produces degraded status.

## Docker and metrics — SEC-0108–SEC-0109, JOB-0090–JOB-0093

Worker readiness reporting, paid Cloud dispatch and resume now require one
unambiguous `HEALTHY` signed check for
device identity, Docker, approved image and sandbox self-test. A missing or
negative or contradictory check refuses Cloud offer/resume and renders seller `NOT_READY`;
a failed self-test raises an automatic Cloud security block before dashboard
observation. `tests/m07-postgres-integration.mjs`,
`tests/m07-result-postgres-integration.mjs`,
`tests/m12-postgres-integration.mjs`, `tests/worker-operational-health.test.mjs`
and `tests/availability-reporter.test.mjs` probe these negative cases. The
paid browser path shows Docker/image readiness, last self-test time and
isolation result from signed telemetry. Job health uses a documented seven-day
window; its denominator contains successful and failed execution attempts,
while pre-execution platform cancellation is separate. The paid browser test
compares the rendered failure rate with authoritative job counts after real
completion, failure and cancellation.

## Failure handling — JOB-0026

The same paid run kills the Worker during an active OpenClaw request, expires
the lease through the scheduler, proves one terminal transition, releases the
reservation with zero settlement/result, restarts the Worker and removes its
orphan container and staged buyer input. A separate paid model/OpenClaw process
failure produces `FAILED_EXECUTION`, a safe buyer error, no seller earning and
clean Docker resources. The Docker adapter records bounded numeric exit code,
stderr byte count and digest without storing raw stderr; the real paid Worker
log assertion and a forced Docker exit-17 test prove that path. Existing
Docker-unavailable, private-network denial and missing-secret readiness tests
cover the remaining §36 fail-closed cases.

## Still open

The broader §§376–381 capability-health, warning-history and CLI gates need
their own exact review. This page does not promote those separate items.
