# M16 original §381 health-history review

The Cloud stores one current heartbeat row per Worker/control plane, not an
append-only stream of raw heartbeat payloads. `PostgresWorkerHeartbeatRepository`
records bounded-code operational events only when a capability's effective
readiness checks change, a security block starts, a Worker becomes stale or a
Worker reconnects. A repeated healthy heartbeat does not create a new event.
An omitted capability report fails closed, changes that capability to
`NOT_READY` and records `READINESS_REPORT_MISSING` once.

`PostgresSellerOperations.dashboard` returns at most 100 recent events scoped
to the seller and joins the affected Worker or capability name. The seller
timeline renders these names and event codes; it never contains raw stderr,
job content, private host paths, or secret values. The code paths and
transition behavior are exercised by `tests/m13-postgres-integration.mjs`,
`tests/m12-postgres-integration.mjs`, and
`tests/browser-m12/seller-operations.spec.ts`. The M13 test deliberately
sends an unchanged heartbeat followed by an omitted readiness report and
recovery. The M12 suite checks stale/reconnected/security events and sanitized
code shape. The browser test shows the affected capability on the timeline.

This verifies the specific §381 health-history behavior. It does not stand in
for external security review or production retention-policy evidence.
