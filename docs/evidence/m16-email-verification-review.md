# Email ownership boundary (§575, `AUTH-003`)

The local auth integration test creates an email/password account without a
session, rejects sign-in before verification, consumes a short-lived single-use
verification link, then admits the verified account. The buyer and seller HTTP
routes derive identity from that session or from a scoped API key.

The disposable PostgreSQL regression in `tests/m13-postgres-integration.mjs`
also creates an unverified account directly, bypassing the UI to attack Core
boundaries. It rejects API-key creation, seller-profile creation and credit
purchase without creating a purchase row. After verification it admits the key
and seller profile. Removing verification again invalidates that existing key
and rejects Stripe Connect onboarding. `packages/persistence/src/marketplace-buyer.ts`
and `packages/persistence/src/finance.ts` recheck active, verified ownership
inside the paid job and reservation transactions. Seller publication and
operations recheck the same predicate at their server boundaries.

Evidence: `pnpm test:postgres:m13` passed 2/2 on 2026-10-07; the 32-step M16
boundary matrix includes the local auth, seller-publication and buyer API
integration suites. This proves the verified-ownership gate independently of
the unavailable Stripe test-provider acceptance path.
