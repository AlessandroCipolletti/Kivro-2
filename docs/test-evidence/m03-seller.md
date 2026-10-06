# M03 seller entry evidence — 2026-10-06

## Executed

- `pnpm typecheck`, `pnpm lint`, `pnpm test`: pass; 94 unit/architecture tests.
- `pnpm test:postgres:m03`: pass on disposable PostgreSQL 16, including visibility, private grant, lifecycle and append-only seller acknowledgement checks.
- `pnpm local:auth:migrate`: forward migration `0009_seller_execution_ack.sql` applied to the local development database.
- `pnpm test:seller:local`: pass against local PostgreSQL; concurrent requests create one profile and one statement acknowledgement, and unverified/suspended accounts fail.
- `pnpm test:auth:local`: pass against local PostgreSQL and Mailpit; real session ownership, no cross-origin POST, no caller account override, explicit confirmation and idempotent profile response.
- `pnpm test:auth:browser`: pass in Chrome; verified email account creates a seller profile only after checking the execution-model statement, then a signed-out visit to `/seller` redirects to sign-in.
- `pnpm --filter @kivro/web build`: pass with dynamic protected seller routes.

## Visual review

The browser test generates ignored `test-results/m03-seller-desktop.png`, `test-results/m03-seller-mobile.png`, and `test-results/m03-seller-mobile-panel.png`. The desktop layout has a clear two-column hierarchy and a draft-state panel. At 390 px the page is legible, the panel has no horizontal overflow, and step descriptions wrap cleanly. Initial mobile review revealed that the shared `nav-link` breakpoint hid the account sign-out button; the selector now hides only links and the full browser test passes. The Next development overlay appears in screenshots and is not product UI.

## Limits

The seller profile is a draft identity and an execution-model acknowledgement, not a Worker connection or resource consent. Discovery candidates are still seller-local; no discovered skill is exposed in cloud or purchasable. Full wizard, readiness, sandbox, payout, publication and both-profile conformance gates remain open.
