# Persisted job transitions (§51, `SEC-0052`)

`PostgresJobExecutionRepository` writes each state-machine transition and its
actor, reason, attempt and correlation identifiers to `job_transitions` in the
same transaction as the authoritative job status. It rejects conflicting
replays. Worker ownership and leases are stored in `job_executions`; the local
Worker persists its own execution/outbox state in SQLite.

`tests/m07-postgres-integration.mjs` constructs a new repository against the
same PostgreSQL database after offering a job, reconciles that persisted
execution under the owning control plane, rejects an alternate plane and
checks the transition trace fields. `tests/m16-installed-worker-e2e.mjs`
restarts the host-native Worker after a secured purchase, loses the result
acknowledgement, restarts again, replays the outbox and asserts one final job
transition and one settlement journal. Both suites passed in the 2026-10-07
M16 boundary matrix. This closes the original `SEC-0052` persistence and
recovery requirement; it does not claim unrelated M29 notification/scheduling
recovery or Stripe staging acceptance.
