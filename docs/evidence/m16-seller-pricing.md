# M16 seller pricing display — original Master Spec §294

The installed development-credit E2E (`pnpm test:e2e:local`, 2/2 on
2026-10-08) publishes a paid capability through authenticated seller Web
approval, buys it as a separate buyer and completes it through the installed
Worker, pinned Docker/OpenClaw, private storage and one ledger settlement.

`tests/m16-installed-worker-e2e.mjs` reopens the seller dashboard and checks
the capability buyer price, marketplace fee and seller proceeds against the
immutable job price snapshot. It checks the settled job row against the same
snapshot. For the dashboard summary it independently sums only `SETTLE`
journals with `SETTLED` payment states, then checks the rendered gross buyer
sales and marketplace fees. This avoids assuming that the seller has only one
settled job. The interface labels gross sales as marketplace sales, distinct
from seller earnings. The source projection is
`packages/persistence/src/finance.ts` and
`packages/persistence/src/seller-operations.ts`; the view is
`apps/web/app/seller/operations-dashboard.tsx`.

This verifies `PRD-0304` for the local paid-credit path and does not claim a
Stripe test purchase or Connect payout.
