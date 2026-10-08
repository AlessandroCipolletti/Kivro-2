# Visibility transitions preserve owned jobs — Master Spec §317

The production `PostgresSellerPublicationRepository.changeVisibility` is
seller-authorized, transactionally records transitions and is exercised by
`tests/m14-publication-postgres-integration.mjs` (current tree, 7/7).
`tests/m10-postgres-integration.mjs` (current tree, 1/1) exercises the Core
effect of PUBLIC → PRIVATE → UNLISTED → PUBLIC on search, direct detail,
private grants and example assets. It also changes PUBLIC → PRIVATE while a
paid job is already RUNNING: new discovery is denied, but the existing job
finalizes its result and settles. After a later PRIVATE transition, the
buyer's historical result and the one verified review still exist; the
seller's public profile does not leak the private history. No worker status or
financial transition is derived from visibility alone.

The current-tree `pnpm test:e2e:local` additionally passed 2/2 with a distinct
seller, buyer and ungranted account. While the paid installed Worker was
RUNNING inside pinned Docker/OpenClaw, the seller-authorized Core service
changed PRIVATE → UNLISTED → PRIVATE. The earlier grant was revoked, a new
grant was explicitly issued, the ungranted account still received 404, and
the already purchased job remained RUNNING. It later finalized private files,
settled once and remained in the buyer's authenticated history with its
verified review. The M14 suite separately exercises the PUBLIC transitions
through seller authority. Together these close the original §317 behavior
for `JOB-0066` and `JOB-0067`; Stripe and deployed-provider acceptance remain
separate gates.
