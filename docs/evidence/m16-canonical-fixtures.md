# Canonical end-to-end fixtures (§90, `IO-0037`)

The `m16-document-analyzer` fixture has one seller-reviewed OpenClaw skill,
one approved model route, buyer question and TXT file input, no browser or
personal database access, and `summary.md` plus `structured-result.json`
outputs. `pnpm test:e2e:local` authenticates distinct seller/buyer users,
publishes the reviewed capability, uploads and finalizes the private buyer
file, reserves development credits, executes pinned OpenClaw in Docker,
validates/stores both outputs, serves authenticated buyer downloads and
asserts exactly one ledger settlement. Discovery/import tests establish the
read-only skill selection and immutable package used by this path.

The second fixture in `tests/m06-postgres-integration.mjs` selects a synthetic
read-only private PostgreSQL resource and runs a named operation through the
real Docker/OpenClaw Worker broker. It asserts that private tables, writes,
raw SQL and credentials are denied. Both fixtures passed in the 32-step M16
boundary matrix on 2026-10-07.

Original §90 asks these fixtures to validate reservation and settlement; it
does not make a Stripe purchase part of this fixture. The distinct §92 final
product release gate still requires real Stripe test-provider acceptance and
remains non-VERIFIED.
