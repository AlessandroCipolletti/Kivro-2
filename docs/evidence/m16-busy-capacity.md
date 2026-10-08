# M16 paid Worker capacity and BUSY evidence

Master Spec §339 requires a healthy capability with full immediate capacity to
appear BUSY, permit a bounded queue when configured, reject purchases once the
queue is full, and avoid invented wait estimates.

`apps/worker/src/runtime-readiness.ts` now reports dependency/security readiness
independently from available execution slots. Its local admission result still
requires `capacityAvailable`, and local or security pause still blocks readiness.
`apps/worker/src/availability-reporter.ts` sends the distinct READY capability
state and `runningJobs`/`capacity` values in the signed heartbeat. Shared Core
`packages/persistence/src/availability.ts` combines those into BUSY.

Current-tree executable evidence:

- `node --test tests/worker-runtime-readiness.test.mjs
  tests/worker-admission.test.mjs tests/availability-reporter.test.mjs` passed
  8/8. Full unit suite passed 324/324 active tests with five intentional skips.
- `pnpm test:postgres:m09` passed 1/1, including a full slot, bounded queued
  purchase, denial of a second Worker offer, and `QUEUE_FULL` purchase denial.
- `pnpm test:e2e:local` passed 2/2. The installed paid Worker held one real
  Docker/OpenClaw execution at its slot limit. Core and buyer browser showed
  BUSY without a fabricated ETA. The buyer's second paid purchase was queued,
  had no execution, and cancellation released its authoritative reservation.

This closes the §339 `JOB-0077` section and individual `JOB-0078` optional
ETA criterion. It does not assert complete §338 ONLINE readiness or every
cross-capability/physical-sleep availability scenario.

For the original §26 MVP gate, the same real paid Worker/browser fixture proves
the default one-slot execution boundary and truthful BUSY buyer status, while
`tests/m09-postgres-integration.mjs` proves offline admission denial, bounded
queueing and no impossible immediate quote. `tests/browser-m12/seller-operations.spec.ts`
proves seller pause through the authenticated dashboard; the installed E2E
proves queued purchase and reservation release. These together close
`AVL-0001` without claiming that future multi-Worker or physical sleep
scenarios are part of §26.
