# Implementation status

## Current milestone boundary

M00–M09 implementation stages have been reached. M09's shared Core scheduling stage is implemented and validated; M10 buyer marketplace work has not started. This does **not** mean Kivro is ready for public paid use. `spec/COVERAGE.md` is the per-requirement evidence matrix and `docs/verification-backlog.md` lists every open `DEFERRED_VERIFICATION` gate with its missing component and exact closing test. Later-owned `TODO` requirements remain visible in the matrix. The original `spec/MASTER-SPEC.md` and `spec/REQUIREMENTS.md` remain authoritative.

## Implemented through M09

- M00–M03: repository boundaries, strict contracts, auth/identity, seller entry, read-only OpenClaw discovery, draft dependency selection, version/publication and visibility foundations.
- M04–M06: deny-by-default Docker sandbox, private object-storage transfer, contract/file validation, Research and Local Resource Brokers, provider budgets and SSRF protection.
- M07: durable cloud job/Worker Protocol state, signed identity and leases, isolated pinned OpenClaw execution, Worker pause/control, validated output and private result finalization. The local image approval remains exact digest/source bound.
- M08: prepaid USD Credits, balanced immutable journal, job reservations and release/settlement, exact fixed price tiers, server-only Stripe/Connect adapters, seller economics and authoritative paid execution verification. Live Stripe credentials, deployed recurring reconciliation and public buyer/seller payment flows remain open.
- M09: seller-local IANA schedules and DST, Worker/capability availability and readiness, short-lived quotes, durable earliest-available booking and deterministic queue/capacity admission. Booking and M08 reservation commit together; M07 checks eligibility before offer, claim and start. A host-native scheduler reconciles waiting work and releases expired or cancelled reservations. See `docs/milestones/M09.md` and `spec/DECISIONS.md` DEC-IMPL-014.

## Current limits and next dependencies

Buyer marketplace/job pages (M10), Marketplace Agent (M11), seller operational UI (M12), authenticated scheduling/job APIs and outbound notification delivery (M13), two runnable deployment profiles (M19), real browser-to-Worker paid E2E (M16) and physical sleep/fault testing (M26) remain open. Component tests do not close those cross-system gates. M09's 150 mapped requirements are classified in `spec/COVERAGE.md`: 54 narrowly VERIFIED, 52 DEFERRED_VERIFICATION, 43 later-owned mandatory TODO and one explicitly optional post-MVP DEFERRED item (§408). Ten previously deferred narrow M03/M08 availability/payment gates closed with real M09 PostgreSQL tests; the rest retain their required closing evidence.

## Local validation

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:postgres:m07`, `pnpm test:postgres:m08`, `pnpm test:postgres:m09` and `pnpm test:openclaw:execution`. The PostgreSQL scripts use disposable Docker databases; the OpenClaw suite builds the pinned local image and runs real isolated jobs. `pnpm scheduler` starts the host-native M09 reconciliation process using `DATABASE_URL`, `KIVRO_STRIPE_MODE` and `KIVRO_SCHEDULER_INTERVAL_MS`; `node tools/kivro-scheduler.mjs --once` performs one sweep after a build. The documented local web/auth/storage setup is in the root README and `.env.example`. Deployment scheduling is an M19 acceptance dependency.

## Sequencing rule

Milestone implementation may advance while a mapped cross-system gate remains `DEFERRED_VERIFICATION` only if the milestone-owned implementation exists and the named later component is physically necessary for full evidence. A later milestone must execute the gate when its final dependency appears. No mandatory requirement is permanently complete without real `VERIFIED` evidence. M09 implementation stops before M10.
