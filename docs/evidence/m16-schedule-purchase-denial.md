# M16 review of Master Spec §424 purchase denial

The original §424 matrix separately requires an immediate buyer purchase and
an API purchase to be refused outside the seller's configured schedule.

- `tests/m09-postgres-integration.mjs` stores an authenticated seller custom
  schedule with its next window tomorrow, observes `SCHEDULED_OFFLINE`, and
  asserts that Core's `IMMEDIATE_ONLY` quote fails with that code and a real
  `nextAvailableAt`. The scheduling and payment authority is shared Core.
- `tests/m13-postgres-integration.mjs` performs an actual buyer REST `POST`
  with an otherwise valid paid purchase after the seller's schedule closes.
  It gets HTTP 409 and `CAPABILITY_SCHEDULED_OFFLINE`, exposes the correct
  public availability without the private weekly schedule, and proves no
  buyer credits are reserved.

Both suites passed in the current-tree 32/32 M16 boundary matrix recorded in
`docs/evidence/m16-boundaries.json`. This closes the two individual §424
purchase-denial checks (`AVL-0056`, `AVL-0057`). It does not claim that every
other §424 schedule scenario or deployed provider parity has passed.

The current-tree `pnpm test:browser:m12` additionally passed 1/1. An
authenticated seller used the actual graphical service-hours editor to save a
five-day custom schedule, reopened it, chose **Always available while Worker
is ready**, saved again, and the test read back `ALWAYS_AVAILABLE` with no
weekly windows from PostgreSQL. This closes the individual seller-choice
check `AVL-0055`, while the broader §424 matrix remains open.
