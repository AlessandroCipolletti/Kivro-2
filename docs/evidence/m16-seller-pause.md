# Paid seller pause and resume — Master Spec §§342, 428–429

The current `pnpm test:e2e:local` run passed 2/2 with separate seller and
buyer identities, authenticated seller Web controls, a reserved paid job,
host-native Worker, pinned Docker/OpenClaw and private result storage. The
seller paused a running job from the graphical dashboard while a brokered
provider request was in flight. The durable Core transition was
`RUNNING → PAUSE_REQUESTED → PAUSED`; the second transition occurred only
after the authenticated Worker acknowledged local Docker pause. Docker
inspection confirmed the complete container was frozen. The reservation
remained `RESERVED` and no new provider call occurred while paused. The seller
resumed from the same Web UI; the job completed with one `SETTLE` journal.

The same installed run exercised per-capability Pause new jobs and global
Pause all new jobs during another running paid execution. New purchases were
denied without stopping that execution; Web resume restored availability.
`tests/browser-m12/seller-operations.spec.ts` covers the displayed counts,
maintenance timer and schedule precedence. `tests/m12-postgres-integration.mjs`
covers owner isolation, idempotent control revisions, offline cloud pause,
security-block precedence and sanitized audit history. The platform-wide
dispatch control remains independently tested in the M15 suite.

The original §429 local graphical control is conditional on a **future**
Worker desktop application. No such desktop app is specified for the current
release. The primary seller graphical interface is the Web dashboard and its
real paid pause/resume path passed. The supplementary local CLI persists a
pause without cloud connectivity and survives restart in
`tests/worker-job-control.test.mjs` and `tests/worker-cli.test.mjs`.

The adversarial E2E initially exposed a real race: Core marked
`PAUSE_REQUESTED` before the command reached the Worker, so a research RPC
was terminally denied. Core now returns a distinct `PAUSE_PENDING` only after
checking the authoritative payment reservation and lease. Both signed HTTPS
polling and WSS preserve that code. The Worker broker releases its local
activity barrier, retains the unanswered request and retries after resume;
it never grants a new provider call while locally paused. A bounded in-flight
provider request that cannot quiesce returns a verified `RUNNING` outcome
instead of a false `PAUSED` claim. PostgreSQL, transport, unit, real Docker
supervisor and full installed E2E regressions passed after this correction.

This evidence verifies `JOB-0082`, `JOB-0142` and `JOB-0145`. It does not
claim a future desktop UI, Stripe-backed staging or external security review.
