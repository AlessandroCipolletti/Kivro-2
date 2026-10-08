# M16 original §425 availability hierarchy review

Shared Core `PostgresAvailabilityRepository.publicStatus`, quote and booking
apply the original six layers in order. `MarketplaceBuyerRepository` uses that
same authority before M08 reservation; the scheduler and M07 offer/lease path
recheck eligibility, and the local Worker independently refuses an unhealthy
or unauthorized offer.

| Layer | Executed evidence |
| --- | --- |
| Buyer visibility | `tests/m09-postgres-integration.mjs` revokes a private grant and denies quote; `tests/m10-postgres-integration.mjs` tests buyer catalog isolation. |
| Seller/platform control | `tests/m12-postgres-integration.mjs` proves durable pause and security block cannot be cleared by stale resume; `tests/browser-m12/seller-operations.spec.ts` uses the authenticated seller controls. |
| Schedule | M09 PostgreSQL proves closed-window quote/booking and revalidation; the installed paid E2E closes service hours during a running Docker job, denies a new REST paid purchase before reservation and preserves the already-running job. |
| Device | M09 PostgreSQL makes the heartbeat stale and observes OFFLINE/no immediate quote; installed Worker E2E crashes and reconnects a Worker with lease-safe release. |
| Security and dependencies | M12 PostgreSQL auto-blocks failed image/isolation/version health; installed paid Worker E2E stops its local inference model and proves no new execution while unready. |
| Capacity | M09 PostgreSQL enforces the one-slot queue and queue-full denial; installed paid Worker/browser E2E shows BUSY, leaves the second purchase queued with zero executions and releases credit on cancellation. |

The real paid local path and the same shared Core state-machine tests establish
that one layer cannot be bypassed merely because the others pass. The seller's
period and limits remain authoritative; browser/Agent/API presentations consume
Core projections. The local E2E uses development credits, so this evidence
does not claim a Stripe-funded staging purchase or deployed Netsons/AWS parity.
