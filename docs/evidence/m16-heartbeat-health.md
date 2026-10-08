# M16 original §374 heartbeat-health review

The Worker sends signed, sanitized heartbeats with version, capacity,
operational checks and per-capability readiness. Cloud persists the most
recent report per Worker/control plane and computes availability from a
30-second freshness limit. It does not use the seller's local process status
as proof that the Cloud can dispatch.

`tests/m12-postgres-integration.mjs` expires a signed heartbeat, runs the
production stale-Worker sweep, proves it emits one offline event, then sends a
new signed report and verifies reconnection. The local CLI test shows a
persisted local pause and pending Cloud synchronization from a new process.
`tests/m09-postgres-integration.mjs` expires the heartbeat of a published,
paid-schedulable capability and proves the buyer projection is `OFFLINE`,
cannot schedule, and cannot obtain an execution quote. The installed paid
Docker/OpenClaw E2E kills and restarts a real Worker, verifies failed owned
execution is released once, and waits for fresh readiness before later jobs.
The seller browser dashboard renders the last heartbeat and explicit
connection state. These tests all passed in the current 32/32 M16 boundary
matrix on 2026-10-08.

This closes §374's local/Cloud distinction and OFFLINE marketplace behavior.
It does not prove physical laptop sleep or deployed Netsons/AWS parity.
