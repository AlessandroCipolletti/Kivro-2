# M16 §116 local services and resource admission review

`WorkerRuntimeReadiness.check` is called before a paid offer can be admitted.
It validates exact immutable review/package bytes, approved Docker/OpenClaw
image, configured inference service, required credential presence and every
declared seller resource through `checkWorkerResourceReadiness`. The Worker
reporter sends signed per-version readiness to Core; the local
`assessJobOffer` separately requires fresh readiness and free capacity. Core
never treats a connected Worker as sufficient authorization to dispatch.

`JOB-0051` now has a direct missing-secret path: the Worker probes every
seller-declared credential reference, including the provider credential,
through the device-scoped OS vault and rejects paid admission when a required
reference is absent. `tests/worker-resource-ports.test.mjs` and
`tests/worker-runtime-readiness.test.mjs` exercise the missing reference;
`tests/worker-admission.test.mjs` proves a secured payment cannot override
`requiredSecretsReady=false`. No credential bytes are sent in heartbeat or
offer messages.

`JOB-0054` uses the stored signed review and exact reviewed hashes on each
offer. The lightweight checks inspect current image approval, vault presence,
model/destination health, selected-file binding and declared resource health;
the representative sandbox review remains a separate publication/version
step. No representative job or expensive full review is executed as part of
`WorkerRuntimeReadiness.check`.

Executed evidence for **required local services** (`JOB-0052`):

- `tests/docker-local-inference-local-integration.mjs` runs pinned offline
  Docker/OpenClaw through a local model service.
- `tests/m16-installed-worker-e2e.mjs` then stops that model's health endpoint
  during the authentic paid Worker journey. A new paid purchase is denied or
  held without any execution; after the service recovers, readiness returns
  and paid jobs can run again.

Executed evidence for **required resources** (`JOB-0053`):

- `tests/selected-local-file.test.mjs` uses a real version-pinned seller file.
  Admission readiness is true for its unchanged binding and false after its
  contents change, before the Worker can accept another paid offer.
- `tests/docker-openclaw-selected-file-local-integration.mjs` and
  `tests/docker-selected-file-broker-local-integration.mjs` prove the real
  sandbox can read only the approved file through the broker.
- `tests/m06-postgres-integration.mjs` and `tests/docker-sandbox-resources-local-integration.mjs`
  run dedicated read-only database/API resource contracts and denial paths;
  `pnpm test:resource:e2e` runs the real Docker/OpenClaw database broker
  scenario from the M06 PostgreSQL fixture.

Before acceptance, `tests/worker-dispatch-loop.test.mjs` now sends the same
unready paid offer twice. The Worker refuses both deliveries without accepting
or executing it, and the polling loop remains alive. In
`tests/m09-postgres-integration.mjs`, an offered paid job retains exactly one
reservation while an unaccepted offer expires. A restarted repository
requeues it once, a second expiration requeues the retry, and buyer
cancellation releases the full reservation exactly once. This exercises the
specified requeue/release policy without treating Worker refusal as financial
truth (`JOB-0055`).

The full §116 section still requires the complete one-at-a-time paid offer
fault matrix for manifest, OpenClaw, sandbox, inference, secrets, services,
resources and policy. The individual secret, lightweight-check and
requeue/release rules have direct executable evidence above.
This document does not equate resource/tool functionality with payment
authorization.
