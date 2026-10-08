# Paid availability admission (§26, `AVL-0002`)

The buyer API uses `PostgresMarketplaceBuyerRepository`, which asks the shared
availability repository for an authoritative quote and revalidates admission
inside the paid purchase transaction. A stale browser quote cannot substitute
for a live Worker/readiness/schedule check.

`tests/m13-postgres-integration.mjs` exercises the real buyer REST handler,
PostgreSQL availability state and finance repository. When a seller schedule is
closed, a paid immediate request returns `CAPABILITY_SCHEDULED_OFFLINE` with a
future availability time and leaves reserved credits at zero. After restoring
the schedule, expiring the Worker's heartbeat and setting it `OFFLINE` makes the
same purchase return `CAPABILITY_OFFLINE`; reserved credits remain zero.

`tests/m16-installed-worker-e2e.mjs` exercises the other side: an online
host-native Worker and real Docker/OpenClaw receive a paid job only after the
distinct buyer gets an authoritative Web quote and the credit reservation is
secured. Both tests passed in the 2026-10-07 M16 matrix. The broader §26
section-coverage row `AVL-0001` remains open for its complete status/capacity
cross-system fixture.
