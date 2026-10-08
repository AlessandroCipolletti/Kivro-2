# M16 §338 inference readiness at the paid execution boundary

`tests/m16-installed-worker-e2e.mjs` runs a distinct buyer and seller through
an installed host-native Worker and pinned Docker/OpenClaw runtime. After a
successful paid result, the controlled seller local inference service stops
passing its health check. The Worker heartbeat changes the published
capability from READY, and a new paid purchase is either refused with HTTP
409 or remains waiting with **zero** Worker executions when the durable
scheduler runs. The buyer can cancel a waiting reservation. Once the local
model recovers, the Worker reports READY again and later paid work executes.

`apps/worker/src/runtime-readiness.ts` performs the model check before local
offer admission; `apps/worker/src/availability-reporter.ts` sends signed
per-version readiness; shared Core `packages/persistence/src/availability.ts`
does not report ONLINE from device connectivity alone. This closes the
specific §338 `JOB-0076` requirement that required inference be healthy for
ONLINE.

The full §338 `ONLINE` predicate is exercised by the six-layer matrix in
`docs/evidence/m16-availability-hierarchy.md`: published/visible version,
seller control, Worker connectivity, signed per-version readiness, security,
capacity and queue all have independent denial cases. A changed approved
runtime now reports `DEPENDENCY_BLOCKED` and removes ONLINE; a changed
seller-selected file fails local resource readiness before offer admission;
real Docker refuses a missing pinned image. M09 PostgreSQL, M12 security
heartbeat, Worker readiness/admission and the installed paid E2E exercise the
same Core/Worker path. These close `JOB-0074` and `JOB-0075` without claiming
that a deployed provider profile or physical laptop sleep has been tested.
