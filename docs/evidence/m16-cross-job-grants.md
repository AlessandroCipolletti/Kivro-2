# Cross-job asset grant hardening

Master Spec §226 calls for a scoped READ grant from a completed source job to
one target job. Migration `0031_explicit_read_only_asset_grants.sql` persists
the previously implicit READ permission with a database CHECK. The existing
asset-grant trigger still prevents changing that permission, grant identity,
or expiry outside its controlled extension rule. `PostgresJobExecution`
inserts `READ` explicitly.

`pnpm test:postgres:m05` passed the SQL rejection of a WRITE update and
one-way revocation. `pnpm test:postgres:m11` passed the orchestration chain:
one source object is reused, the target Worker gets only the required asset
binding and short-lived signed GET, an unrelated Worker is rejected, the
source object key/job ID are absent from the Worker payload, and revocation
denies another accepted-input read.

## Distinct-seller cross-job grant closure

The disposable PostgreSQL integration in `tests/m11-postgres-integration.mjs`
now composes a paid DAG with source capability/job A owned by seller A and
Worker A, and target capability/job B owned by separate seller B and Worker B.
The buyer owns both jobs. After A's output is validated, finalized and
settled, the planner persists a single scoped `READ` grant with source asset,
target job and expiry. B's input manifest references the same asset ID;
the `assets` table still has exactly one source object. No duplicate object
is copied.

`PostgresJobExecutionRepository.acceptedInputForWorker` is the production
path for the authenticated Worker input projection. The test accepts the B
offer using Worker B's identity and lease, then confirms the projection
contains only the explicitly linked asset binding and signed download. It
contains neither A's job ID nor A's storage object key or seller metadata.
Another Worker identity cannot read the B projection. Asset retention is
extended without extending the existing grant; a simulated clock after
grant expiry denies a new staging operation while the asset itself remains
retained. One-way revocation denies staging again. The database trigger
refuses shortening or reviving grants.

This closes the original §226 scoped-grant semantics (`IO-0121`–`IO-0124`)
with separate sellers and Workers through the authoritative Core projection.
It does not claim a two-host installed Worker transport E2E, Stripe staging
or cross-provider deployment proof.
