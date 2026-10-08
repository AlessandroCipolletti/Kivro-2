# M16 database boundary audit

Original sources: Master Spec §§14 and 71. This closes the old component-only DB
backlog with a real resource execution, not a raw SQL tool exposed to OpenClaw.

`tests/m06-postgres-integration.mjs` creates `seller_readonly` with
`NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE` and a connection limit. It grants
only `USAGE` on `seller_public` and `SELECT` on `seller_public.company`.
The named `company_get` broker operation reads only `id` and `company_name`,
one row, with an approved-tenant predicate and a statement timeout. Queries
for a private table, deletion, an undeclared operation, SQL-injection lookup
and a privileged credential all fail. The Worker resolves the dedicated
connection string outside the Docker/OpenClaw container. The model tool call
contains only the declared resource/operation/lookup and receives the bounded
row; the test asserts the model request and audit omit secrets and private
table content.

`pnpm test:resource:e2e` runs the same broker from pinned Docker/OpenClaw,
builds a signed Worker review, obtains authenticated seller Web approval, and
compares the public buyer manifest with the actual `READ_ONLY` policy. The
buyer HTML is checked for private resource ID, seller credential reference,
private schema name and secret-row marker. The resulting file is
`docs/evidence/m16-browser/m16-public-database-mobile.png` (desktop capture
also exists). The development fixture does not claim a live customer database.

The conditional allowance for direct read-only DB access in private beta is
unused: Kivro uses the broker architecture already. The separate §299 public
manifest example remains open where it requires a selected seller dataset in
the same representative capability.
