# Implementation status

## Current milestone boundary

M00–M11 implementation stages have been reached. M11's Marketplace Agent/platform inference stage has component implementation and validation. This does **not** mean Kivro is ready for public paid use. `spec/COVERAGE.md` is the per-requirement evidence matrix and `docs/verification-backlog.md` lists every open `DEFERRED_VERIFICATION` gate with its missing component and exact closing test. Later-owned `TODO` requirements remain visible in the matrix. The original `spec/MASTER-SPEC.md` and `spec/REQUIREMENTS.md` remain authoritative.

## Implemented through M11

- M00–M03: repository boundaries, strict contracts, auth/identity, seller entry, read-only OpenClaw discovery, draft dependency selection, version/publication and visibility foundations.
- M04–M06: deny-by-default Docker sandbox, private object-storage transfer, contract/file validation, Research and Local Resource Brokers, provider budgets and SSRF protection.
- M07: durable cloud job/Worker Protocol state, signed identity and leases, isolated pinned OpenClaw execution, Worker pause/control, validated output and private result finalization. The local image approval remains exact digest/source bound.
- M08: prepaid USD Credits, balanced immutable journal, job reservations and release/settlement, exact fixed price tiers, server-only Stripe/Connect adapters, seller economics and authoritative paid execution verification. Live Stripe credentials, deployed recurring reconciliation and public buyer/seller payment flows remain open.
- M09: seller-local IANA schedules and DST, Worker/capability availability and readiness, short-lived quotes, durable earliest-available booking and deterministic queue/capacity admission. Booking and M08 reservation commit together; M07 checks eligibility before offer, claim and start. A host-native scheduler reconciles waiting work and releases expired or cancelled reservations. See `docs/milestones/M09.md` and `spec/DECISIONS.md` DEC-IMPL-014.
- M10: public current-version marketplace, category/text/filter/sort discovery, seller and capability detail, private favorites and job history, verified paid-job reviews, seller-approved version-bound examples, server-authoritative preflight and quoted credit purchase, private buyer uploads/results, current-terms Run Again, and responsive buyer pages. Public discovery documents are typed Core projections for M11 without Agent inference. See `docs/milestones/M10.md` and DEC-IMPL-015.
- M11: buyer-owned AI Request, current public catalog discovery, deterministic constraints and availability, bounded platform inference adapters for OpenAI/Anthropic, strict read tools, private draft preparation, typed DAG plans, explicit approval, Core-side credit authorization/revalidation, durable reconciliation, safe result chaining, provenance and usage accounting. See `docs/milestones/M11.md` and DEC-IMPL-016.

## Current limits and next dependencies

Seller operational/example authoring UI (M12/M14), formal authenticated job/notification APIs (M13), real browser-to-Worker paid orchestration E2E (M16), two runnable deployment profiles (M19), physical sleep/fault testing (M26) and seller cost validation (M33) remain open. Live OpenAI/Anthropic contract runs require external development credentials. Component tests do not close those cross-system gates. M11's 295 mapped requirements are classified in `spec/COVERAGE.md`: 267 narrowly VERIFIED with real component evidence, 22 DEFERRED_VERIFICATION with named later closing tests, 5 M14-owned TODO and one explicit USER_OVERRIDE for safe `.env.example` samples requested by the user. Fifteen previously deferred narrow gates closed with M11 evidence; the rest retain their required closing tests.

## Local validation

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:postgres:m07`, `pnpm test:postgres:m08`, `pnpm test:postgres:m09`, `pnpm test:postgres:m10`, `pnpm test:postgres:m11` and `pnpm test:browser:m10`. The PostgreSQL scripts use disposable Docker databases; the M10 browser suite uses disposable PostgreSQL and pinned SeaweedFS with Mailpit, and writes visual artifacts to `test-results/`. `pnpm test:openclaw:execution` remains the real isolated Worker regression. `pnpm scheduler` starts the host-native M09 reconciliation process using `DATABASE_URL`, `KIVRO_STRIPE_MODE` and `KIVRO_SCHEDULER_INTERVAL_MS`; `node tools/kivro-scheduler.mjs --once` performs one sweep after a build. `pnpm agent:scheduler` starts the host-native M11 plan reconciliation caller; `pnpm local:agent:setup` adds its private token to an older `.env.local`. The documented local web/auth/storage setup is in the root README and `.env.example`. Deployment scheduling is an M19 acceptance dependency.

## Sequencing rule

Milestone implementation may advance while a mapped cross-system gate remains `DEFERRED_VERIFICATION` only if the milestone-owned implementation exists and the named later component is physically necessary for full evidence. A later milestone must execute the gate when its final dependency appears. No mandatory requirement is permanently complete without real `VERIFIED` evidence. M11 implementation stops before M12.
