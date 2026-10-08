# M16 closure: concurrency and seller job pause

Master Spec §343 is implemented by the shared availability policy and
PostgreSQL booking transaction. In `tests/m09-postgres-integration.mjs`, a
published maximum of four, seller choice of two and reported Worker capacity
of one admit exactly one immediate buyer booking; reported capacity of three
admits exactly two. Further buyer quotes fail `QUEUE_FULL`. M13's paid API
final-slot race and Agent constraint tests cover concurrent entry points and
the lack of buyer/Agent authority to raise seller limits. The installed local
paid E2E exercises a BUSY Worker and preserved reservation.

Master Spec §§342 and 426–428 are exercised by
`tests/m16-installed-worker-e2e.mjs`. A seller clicks graphical **Pause job**
for a running, credit-reserved job while OpenClaw has a brokered provider
request in flight. The test observes durable `PAUSE_REQUESTED` and the
**Pause requested…** UI, then locally frozen Docker and Worker-acknowledged
`PAUSED`. It proves no extra provider call or financial settlement while
paused. Graphical Resume completes the job with one settlement. The same
run checks capability and global pause deny new paid purchases while the
existing job continues. M12 PostgreSQL tests cover seller ownership,
replayed control revisions, cloud-offline state and security precedence;
M12 browser checks maintenance timing and displayed running counts.

The §429 desktop-app control is conditional on a future local desktop app.
No such application is shipped. The present primary seller graphical product
is the Web dashboard, whose paid Pause/Resume flow is covered above. The
supplementary local CLI persists its pause independently of cloud
connectivity and survives restart in `tests/worker-job-control.test.mjs`.
This closes the current-product graphical requirement `JOB-0145`, while the
future desktop UI remains `DEFERRED` under `JOB-0143`/`JOB-0144`. The
separate §430 real disconnected-runtime acceptance is not inferred from the
Web test.

These are development-credit local E2E, PostgreSQL and browser results.
They do not prove Stripe-backed staging or deployed provider parity.
