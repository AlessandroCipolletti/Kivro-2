# Master Spec §424 schedule acceptance matrix

The original §424 checklist is exercised by the production shared availability
repository, public marketplace, buyer REST, seller dashboard, Marketplace
Agent and paid Worker path. These are separate assertions against the same
Core scheduling state, not independently computed schedules in each UI.

| Original check | Executable evidence |
| --- | --- |
| Always Available, weekly windows and seller editing | `tests/browser-m12/seller-operations.spec.ts` writes both modes through the seller UI and checks persisted policies; `tests/m09-postgres-integration.mjs` writes them through Core. |
| Overnight 20:00–07:00, weekdays/weekends, IANA zone and DST | `tests/availability-schedule.test.mjs` checks Europe/Zurich and America/New_York wall-clock windows across both DST boundaries; the seller browser fixture stores Europe/Zurich weekday windows. |
| Outside schedule, inside with healthy Worker, BUSY, sleeping/offline Worker | `tests/m09-postgres-integration.mjs` checks `SCHEDULED_OFFLINE`, `ONLINE`, `BUSY`, stale heartbeat `OFFLINE`, `nextAvailableAt` and safe scheduling refusal. |
| Buyer immediate purchase and API purchase outside schedule | `tests/browser-m10/marketplace.spec.ts` checks the buyer preflight/error, future purchase and historical display; `tests/m13-postgres-integration.mjs` checks the REST `CAPABILITY_SCHEDULED_OFFLINE` result and the same public projection. |
| Marketplace Agent schedule constraint | `tests/m11-agent.test.mjs` exercises immediate, future-allowed and deadline modes, including exclusion of a future-only capability from immediate execution. The planner uses `PostgresAvailabilityRepository.quote` before purchase. |
| Running survives schedule close; queued/accepted job does not begin after close | `tests/m09-postgres-integration.mjs` keeps a `RUNNING` job running after a schedule edit, prevents an offered/accepted job from starting after closure, and moves unstarted work back to a bounded wait. |
| Manual and security/platform pause override schedule | `tests/m09-postgres-integration.mjs` checks seller pause and platform block precedence; `tests/m12-postgres-integration.mjs` checks security pause publication and cloud directive; `tests/browser-m12/seller-operations.spec.ts` checks seller warning and control. |
| Edit without Worker restart and audit | `tests/m09-postgres-integration.mjs` changes the persisted policy on the same Worker, reconciles eligibility, checks append-only `availability_schedule_audit`; the seller browser test changes the same Core policy through authenticated UI. |
| Buyer prompt cannot change seller schedule | `tests/m16-installed-worker-e2e.mjs` submits hostile buyer input in a real paid Docker/OpenClaw job and compares the seller schedule and capacity before/after. |

The M16 boundary matrix runs all these tests on the same tree. This closes the
§424 automated acceptance checklist. Physical sleep/wake fault attribution,
deployed provider scheduling and notification delivery remain separate open
gates where the original sections require them; §424 does not make one
single end-to-end script a condition for every checklist line.
