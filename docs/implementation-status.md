# Implementation status

## Implemented

- The source specification documents are copied under `spec/`; `spec/COVERAGE.md` is the living evidence matrix.

## Partially implemented

- M00 repository bootstrap and engineering contract: pnpm workspace, strict TypeScript, initial versioned manifest/job-offer schemas, infrastructure ports, architecture import gate and drift canary. The live OpenClaw adapter detects the local version only; config/skill parsing is fixture-only after a real skill-list probe attempted personal-state permission changes. Its implementation stage unblocked M01; 76 mapped gates remain open.
- M01 domain and shared-contract stage: unified account/identity schemas, normalized I/O contract/validation, permission projection, inference ownership, fixed USD tiers, draft version and job snapshot shapes, pure job transition reducer and one PostgreSQL foundation migration. `pnpm typecheck`, `pnpm lint`, `pnpm test` (33 tests), and the real PostgreSQL constraint test passed. All 64 mapped IDs remain open for integration/cross-system verification; five overlap M00 and 59 new entries were added to the cumulative backlog.
- M02 is active. Seller-local SQLite pause/audit state, a fail-closed CLI health/doctor, an encrypted fallback Ed25519 device identity, a dedicated restricted OpenClaw config, and shared verified-email linking policy pass local checks. `pnpm test` passed 50 tests; `pnpm lint` and `pnpm test:openclaw:isolation` passed. Next.js/Better Auth/PostgreSQL dependencies are pinned for auth work, but no auth service or web flow exists yet. Live personal skill import, keychain primary storage, pairing, effective sandbox proof, auth, cloud dispatch and web pause remain unfinished. Sixty-five health/pause cross-system gates are in the cumulative verification backlog; `WRK-0107` is verified by the JSON health CLI test.

## Not implemented

- Buyer and seller applications, cloud API, Worker execution, persistence repositories, payment/ledger, object storage, both deployment adapters, and full conformance/E2E flows.

## Sequencing resolution

- M00 cannot honestly satisfy its literal 77-requirement exit gate during bootstrap: its mapped sections include complete paid delivery (§88), full failure handling (§89), security and product release gates (§§91–92), and Worker execution (§§55–60). Those are dependent on later milestones. Its implementation stage was advanced under the user-approved sequencing rule while the cross-system gates remain open.
- The user resolved the sequencing conflict on 2026-10-06: an implementation stage may unblock the next milestone while each dependent gate stays open with its dependency and closing test in `docs/verification-backlog.md`. Final completion still requires every mandatory gate to pass.

## Security assumptions

- Paid execution is unavailable until payment reservation, device authorization, manifest/policy validation, and sandbox isolation exist and pass their tests.
- The Worker must fail closed when Docker/OpenClaw/security prerequisites are unavailable.

## Known deviations from plan

- The milestone mapping in M00 includes downstream acceptance criteria. The explicit sequencing rule in `spec/IMPLEMENTATION-PLAN.md` carries them forward without claiming implementation or verification from scaffolding.
