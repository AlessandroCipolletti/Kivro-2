# Per-capability readiness on one Worker — Master Spec §348

The current-tree `pnpm test:postgres:m09` passed 1/1. The integration fixture
publishes two versions on one signed ONLINE Worker. It sends a fresh signed
heartbeat where capability A is READY and capability B is NOT_READY because
its runtime dependency is unhealthy. Shared Core's public availability
projection keeps A ready and marks only B `READINESS_BLOCKED`. Earlier in the
same scenario, shared device capacity and queue limits constrain both
capabilities without treating their readiness as one device flag.

`tests/availability-reporter.test.mjs` now also runs the production Worker
heartbeat reporter with two installed package versions: one locally READY and
one locally NOT_READY, while the shared Worker status stays ONLINE. The
current-tree unit case passed 4/4. Together, the Worker reporter and signed
PostgreSQL projection prove the individual `AVL-0016` instruction to avoid
reducing capability readiness to device online/offline; that individual ID is
VERIFIED. The installed paid Worker E2E separately makes a local inference
model unhealthy while its signed Worker remains connected and confirms paid
execution blocks until readiness recovers.

The full §348 section `AVL-0015` and seller-operations section `OBS-0011`
remain OPEN: a real Worker hosting multiple published capabilities with one
genuinely failed local dependency and the corresponding seller UI still need
an integrated run. The synthetic signed heartbeat is not presented as a real
local dependency outage.
