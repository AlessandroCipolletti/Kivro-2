# M16 paid schedule and seller resource boundary

The original Master Spec §414 treats recurring service hours as seller resource
governance. The seller can reserve the machine for personal use; Kivro may admit
new work only in the seller-authorized window and within configured capacity.
§422 separately forbids marketplace job instructions from changing operational
schedule, pause or capacity.

Executable evidence:

- `tests/m09-postgres-integration.mjs` exercises weekly windows, a closed
  schedule, persisted queueing, revalidation, reservation, capacity and
  cancellation against PostgreSQL. A different account cannot change the
  seller's policy.
- `tests/browser-m12/seller-operations.spec.ts` saves Custom service hours
  and Always Available through the authenticated seller UI, then checks the
  authoritative persisted policy.
- `tests/m16-installed-worker-e2e.mjs` starts one real paid
  Docker/OpenClaw job, holds the Worker at concurrency one and verifies Core
  and the buyer browser show BUSY. A second paid job remains queued with no
  execution; cancellation releases its reservation. While the first job is
  RUNNING, the seller closes the schedule through the Core authority. A
  subsequent otherwise-valid REST purchase gets HTTP 409
  `CAPABILITY_SCHEDULED_OFFLINE`, with no job or credit reservation. The
  already-running job continues, as §424 explicitly requires. The Worker
  later completes without changing the seller's policy revision or capacity
  despite hostile buyer input asking it to resume, change service hours and
  increase concurrency.
- `tests/docker-broker-sidecar-local-integration.mjs` probes the real offline
  sandbox's only Worker broker port. Operational schedule, resume, capacity
  and seller pause routes are rejected technically. These are absent from
  the versioned OpenClaw tool allowlist, and Docker has no general network
  route to the cloud control plane.

The installed paid local E2E uses deterministic development credits. These
tests prove the local execution and financial boundaries above; they do not
prove Stripe funding, physical laptop sleep or deployed Netsons/AWS parity.
Those remain separately tracked gates. No full §424 matrix claim follows
from this document alone.

For the separate §343 buyer/Agent capacity-override prohibition,
`tests/m11-agent.test.mjs` proves the strict buyer/Agent constraint schema
rejects seller concurrency, queue, pause and schedule fields. The installed
paid hostile buyer input asks for an increased concurrency limit, but the
seller's policy revision and one-slot execution behavior remain unchanged;
the Docker broker rejects capacity-control routes. This closes the narrow
`PRD-0330` criterion without claiming the full seller-configurable 1–4
concurrency experience has been exercised.
