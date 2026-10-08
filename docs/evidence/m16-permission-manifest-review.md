# M16 permission-manifest review

Source: original Master Spec §§299–301, reviewed on 2026-10-07.

The Core projection in `packages/policy-engine/src/public-manifest.ts` derives
11 public categories from the immutable internal policy, with no seller path,
resource ID, credential reference, database host or private endpoint. Its schema
requires each category exactly once. The signed Worker review and published
version freeze this projection. The buyer capability detail renders every
category and state with plain-language labels; the seller Web approval shows
the same version-specific projection before consent.

`tests/m06-postgres-integration.mjs` executes a declared read-only database
resource through real Docker/OpenClaw, confirms the dedicated PostgreSQL role
cannot read private tables or write public data, and publishes the review in
an authenticated seller browser. The buyer browser shows `Seller Database —
Read Only` for that version, while a separate document version shows `Not
Used`. `tests/m16-installed-worker-e2e.mjs` compares all buyer and seller
labels to the exact Worker review manifest, then runs the paid local-model
document capability through the pinned sandbox. `tests/permission-policy.test.mjs`
proves selected file IDs and credential references are absent from the public
projection; Docker/Worker security tests prove forbidden host paths and
network access are blocked.

The buyer detail now explicitly explains that a capability with no declared
external side effects cannot send messages, publish, purchase or change remote
accounts. This is conditional on the immutable manifest state, not seller
prose. It is asserted in the authentic public browser fixture.

These direct checks close `SEC-0093`, `SEC-0094`, `SEC-0096`–`SEC-0098`,
`CAP-0069` and `CAP-0070`. The public HTML test rejects the private resource
ID, credential reference, schema name, connection string and secret row marker.

The representative §301 Company Intelligence combination, including a selected
seller dataset and public research in one paid installed Worker job, has now
run. The Worker also has a version-bound read-only seller-selected file broker,
and a separate reviewed Docker/OpenClaw package combines research, database,
selected dataset and read-only API before authentic seller publication and
buyer rendering. The original gap recorded here is closed by
`docs/evidence/m16-research-private-resources.md`. Stripe-backed release
acceptance remains a separate unresolved gate.
