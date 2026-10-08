# Durable buyer history (§127)

The buyer dashboard reads Core history, favorites and recently used
projections. Its completed, active and failed/cancelled groups are persisted
job states. Each job detail shows immutable seller, version, date, price,
submitted inputs, result and generated private files, plus a visible review
status. The review status comes from the authoritative completed-job review
record; after submitting a review, the action disappears and the page says
`Submitted`.

`tests/m10-postgres-integration.mjs` exercises history, recently used,
favorite, cancellation, review eligibility and problem-report ownership.
`tests/browser-m10/marketplace.spec.ts` navigates My Jobs and Run Again,
changes the currently published version, then checks the buyer is warned and
shown the current version and price before a new purchase. The installed paid
Docker/OpenClaw fixture closes and reopens the buyer browser, locates the
same durable completed job through My Jobs, downloads both private generated
files, publishes one verified review and records one problem report without a
second settlement. The same buyer later reopens a real Worker-failed paid job
and a cancelled reservation in the persisted failed/cancelled history group.
The failed detail preserves the original price/version/inputs, shows released
payment and no deliverables, exposes no Worker secret, and Run Again displays
the current published version. The buyer saves the capability from that
historical job and a reload retains the favorite. Desktop and 390px result
screenshots were inspected; the mobile page has no horizontal overflow.

`pnpm test:e2e:local` passed after these additions on 2026-10-07. This
closes `JOB-0056` against its complete original §127 source. It remains
distinct from the broader §88 Stripe-backed release sequence and full
media-preview requirements in §361.
