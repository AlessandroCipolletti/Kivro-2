# Implementation status

## Current boundary

M00–M15 have component implementations and milestone records. The M16
implementation and locally executable verification stage is **complete**;
the final current-tree boundary matrix passed 32/32. Those historical
milestone records are not proof of full product compliance. The authoritative
sources are `spec/MASTER-SPEC.md` and `spec/REQUIREMENTS.md`; requirement-level
implementation and test evidence are tracked in `spec/COVERAGE.md`, with every
open implementation or deferred gate in `docs/verification-backlog.md`.

The repository is not ready for public paid use. `pnpm release:gate` currently
fails closed. A development-credit two-account path through the real
Worker review/publication service, installed Worker, Docker/OpenClaw, private results
and exactly-once settlement passes locally. Its payment is deliberately
not Stripe; Stripe-backed staging and final security/provider acceptance
remain open.

## Current M16 evidence

- `pnpm test:boundaries:m16` runs the executable typecheck, lint,
  architecture, unit, web build, PostgreSQL, seller-publication, Docker,
  pinned OpenClaw, private storage, Core/Worker slice and browser suites. Its
  report is explicitly `COMPONENT_ONLY`; passing it cannot satisfy the
  full-system release gates.
- M16 corrected active control-plane issuance in the scheduler and added a
  shared Worker capacity guard, durable per-plane pause revisions, private
  old-route recovery after restart and signed polling/WSS transports under
  one Worker protocol. A live loopback mixed-transport test covers old/new
  ownership, capacity, duplicate offers and drain. Two deployed backend
  composition roots and financial cutover acceptance remain open.
- A selected local inference model can now pass read-only discovery, explicit
  seller selection, private review, exact-model health, a host-side broker,
  durable token/request limits and a real pinned offline Docker/OpenClaw
  execution test. M16 also corrected the production OpenClaw config builder
  so local-only inference no longer requires a remote provider budget.
  The installed-Worker E2E now covers local-model execution failure and
  credit release; exact original §100 acceptance remains open where seller
  CLI discovery, live personal-state proof or other dependencies are absent.
- The deterministic Document Analyzer fixture now supplies a TXT input,
  hash-pinned custom skill and both `summary.md` and
  `structured-result.json` through the Core/Worker Docker component slice.
  Its installed-Worker E2E uses a real signed review/publication, development
  credits and a deterministic local model service. `IO-0037` is VERIFIED
  against its original §90 test-fixture criterion; a second synthetic
  database fixture also runs through actual Docker/OpenClaw and a read-only
  Worker broker. The separate §92 Stripe-backed product release gate remains
  open.
- The Worker now persists seller-declared narrow database/API resources,
  validates permissions during import, composes host-side broker ports and
  denies missing or privileged database credentials. The PostgreSQL fixture
  reads only the declared table and denies the private table through the
  Worker router. A persisted seller visual input-contract editor writes the
  same contract schema consumed by Core. Authenticated seller publication,
  buyer form and paid installed Worker result are exercised together for the
  canonical Document Analyzer. The second database fixture is Docker/OpenClaw
  component evidence, not a Stripe-funded database paid job.

The optional `pnpm test:e2e:local:stripe` runner is wired to a real Stripe
test PaymentIntent, provider reconciliation and a ready test Connect account.
The required credentials and account are absent from this checkout, so it
cannot provide acceptance evidence yet. Both-provider conformance, external
security review and legal product review also remain release gates.

## Local commands

Use `pnpm typecheck`, `pnpm lint`, `pnpm test`,
`pnpm test:boundaries:m16`, `pnpm verification:audit`,
`pnpm verification:index` and `pnpm release:gate` to inspect the current
state. Docker, PostgreSQL, object storage and browser commands in the root
`package.json` run their respective real local boundaries. See the root
`README.md` for setup and `docs/milestones/M16.md` for the current task list.

## Sequencing rule

An earlier milestone's implementation stage can be complete while a genuine
cross-system gate remains `DEFERRED_VERIFICATION`. Missing production behavior
stays `OPEN_IMPLEMENTATION`. A requirement becomes `VERIFIED` only after its
complete specified evidence exists. M16 does not start M17.
