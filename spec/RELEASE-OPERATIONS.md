# Release & Operations Discipline

Each release emits a unified machine-readable manifest covering shared
application version/commit, API version, Worker Protocol compatibility,
DB schema compatibility, capability manifest schema, both adapter
revisions, Worker support/revocation policy and conformance result
reference.

A provider may become ACTIVE only after exact-release
real-infrastructure smoke and staging E2E gates. Backups require
periodic isolated restore evidence. Production readiness defines
measurable RPO/RTO and performance/resource envelopes.

## Result retention release readiness

Before production record active retention policy, storage lifecycle
relationship, metadata backup/restore treatment, binary-object DR
treatment, notification readiness, input/output size policy, and
successful ASYNC conformance for both profiles. Storage lifecycle cannot
delete earlier than the product retention contract.

## Buyer Experience release readiness

Production evidence includes quote/preflight correctness,
deadline/cancel/expiry races, ETA unknown behavior, notification
preferences, reliability metric definitions/sample thresholds, privacy
disclosure payload diff, preview/bundle security tests, dashboard state
coverage and BUYERUX conformance on both profiles.

## Seller Experience release readiness

Release evidence includes fresh-install onboarding, discovery consent,
dependency/permission parity, secret-redaction checks, publish-readiness
blockers, cost-guardrail tests, ledger earnings truth,
auto-pause/recovery, version rollback, maintenance/unavailability
reasons, Doctor sanitation, KYC/public identity separation and
multi-Worker schema/routing conformance.
