# M16 job message authenticity and replay (§68)

The versioned `JOB_OFFER` schema requires job, attempt, Worker, capability
version, expiry, message ID and protocol version. `tests/contracts.test.mjs`
rejects incompatible versions and malformed offers.

`tests/worker-admission.test.mjs` now exercises wrong Worker, wrong control
plane, expired offer, changed capability version, missing secured-payment
attestation and incompatible protocol against the production admission
function. `tests/worker-dispatch-loop.test.mjs` proves a reviewed local package
does not start the same offer twice. `tests/m07-postgres-integration.mjs`
rejects foreign Worker/plane/lease acceptance, replays signed messages
idempotently and reconciles a foreign plane to STOP.

`tests/m16-installed-worker-e2e.mjs` runs signed polling through the installed
Worker and real Docker/OpenClaw, deliberately loses the first finalization
acknowledgement, restarts the Worker, replays the durable outbox, and confirms
one result manifest and one SETTLE journal. This proves the original §68
requirements without treating duplicate Worker output as financial truth.
