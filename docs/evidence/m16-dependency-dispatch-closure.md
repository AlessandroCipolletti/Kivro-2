# §116 dependency-aware paid admission

`apps/worker/src/runtime-readiness.ts` computes fresh readiness against the
stored immutable package and sent seller review before each offer. It checks
review/package hashes, supported pinned OpenClaw version and image approval,
Docker/collector readiness, inference endpoint/model, seller credential,
declared service/resource prerequisites and current policy hash.
`apps/worker/src/job-admission.ts` refuses an offer before acceptance when
any one of these is absent, stale or mismatched. The Worker cannot infer
financial authorization from its own status; the signed offer also needs the
Core reservation.

`tests/worker-admission.test.mjs` denies the offer for changed manifest,
package/version/policy, sandbox, inference/service, secret, selected resource
and stale readiness independently. `tests/worker-runtime-readiness.test.mjs`
executes the production readiness calculator with changed OpenClaw version,
missing approved image, revoked credential, blocked provider destination and
unreviewed package. `tests/worker-resource-ports.test.mjs` and real
`tests/docker-sandbox-resources-local-integration.mjs` cover declared local
service/resource admission. `tests/docker-sandbox-local-integration.mjs`
proves isolation is enforced by Docker and never replaced with host execution.
The installed paid E2E demonstrates that an inference outage produces
NOT_READY and no new paid offer. `tests/m09-postgres-integration.mjs` proves
an unaccepted offer expires/requeues with one secured reservation, and
cancellation releases it once. Financial release is a Core action, never a
Worker-reported effect.

The evidence is a composed local proof of the exact §116 acceptance, not a
claim of Stripe provider staging or an independent security review.
