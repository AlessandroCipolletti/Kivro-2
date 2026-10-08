# M16 original Master Spec §72 network-boundary review

The pinned OpenClaw job container uses Docker `network=none`, a read-only root,
dropped capabilities and bounded resources. It cannot connect directly to
public Internet, localhost, LAN or cloud metadata targets. Its only useful
outbound operation is a narrow, authenticated Worker broker sidecar. The
sidecar checks the live job/lease, and `WorkerBrokerRouter` accepts only
seller-selected tool names and declared policies. Provider/model credentials
are resolved in the host-side completion broker, never injected into the
sandbox. Research and declared API brokers apply destination, method, byte,
rate and cost controls outside OpenClaw.

Executable evidence:

- `tests/docker-broker-sidecar-local-integration.mjs` proves the real offline
  container can call the broker, cannot call public Internet and loses broker
  access when job authorization is revoked.
- `tests/docker-openclaw-exec-local-integration.mjs` runs pinned OpenClaw using
  the host-side provider broker and denies a foreign/disabled sandbox.
- `tests/m16-installed-worker-e2e.mjs` probes a held paid sandbox and denies
  localhost, LAN, metadata and public targets with no credential environment.
- `tests/research-broker.test.mjs`, `tests/declared-api-broker.test.mjs` and
  `tests/m06-postgres-integration.mjs` exercise host/method/DNS/redirect,
  request/response limits, budget and sanitized audit policy.

The §72 first-spike exception for a private experiment with unbrokered
provider egress was not used. This review does not claim provider deployment
parity or an external penetration assessment; those remain separate gates.
