# Independent capability health on one Worker

Master Spec §§348 and 376 require a healthy device to expose separate
capability readiness, not one device-wide online flag. The seller browser test
creates two published capabilities on the same Worker. It now invokes the
production `WorkerAvailabilityReporter` with independent per-version
dependency checks and persists its actual signed heartbeat through
`PostgresWorkerHeartbeatRepository.observe`; the Core reports READY for one
version and DEPENDENCY_BLOCKED for the other while the device remains ONLINE.
The rendered dashboard shows **Available now** with a ready runtime for the
first and **Temporarily unavailable** with a blocked runtime for the second,
alongside each capability's own running/queued counts. The 390px view has no
horizontal overflow and passes axe WCAG 2/2.1 A/AA.

`tests/browser-m12/seller-operations.spec.ts` passed on 2026-10-08.
`tests/m12-postgres-integration.mjs` proves a blocked sibling does not prevent
resuming a healthy capability. `tests/m09-postgres-integration.mjs` proves
capability-level availability and capacity. The installed paid Worker E2E
`tests/m16-installed-worker-e2e.mjs` forces a real inference-health failure,
observes NOT_READY, prevents paid dispatch, and then observes recovery.

This composes the production Worker report producer, PostgreSQL projection,
availability Core and rendered seller UI for `AVL-0015` and `OBS-0011`.
`tests/worker-runtime-readiness.test.mjs` independently checks real readiness
calculation for missing credentials, image and inference; the browser fixture
supplies deterministic per-version check results to expose the two-capability
state. The installed paid E2E exercises one live inference outage, while
`tests/m09-postgres-integration.mjs` verifies queue/capacity arithmetic.
The original §§348/376 do not demand an installed two-capability process as
a distinct acceptance gate. This evidence does not claim deployed two-Worker
capacity or Stripe staging.
