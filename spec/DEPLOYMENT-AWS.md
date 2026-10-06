# AWS Deployment Profile

This file defines AWS-specific mechanics only. Product behavior is
defined by `MASTER-SPEC.md` and shared packages.

## Baseline

-   TypeScript/Node shared Kivro Cloud composition root.
-   PostgreSQL on RDS/Aurora-compatible PostgreSQL.
-   AWS-native durable async/queue/event services behind shared ports.
-   Secure WebSocket Worker transport adapter.
-   S3 object storage.
-   Managed secrets/configuration.
-   AWS-native logs/metrics/alarms/tracing as appropriate.
-   TLS and Kivro-controlled stable service names.

## Hard rules

AWS code must not duplicate Kivro business logic, public API semantics,
payment logic, job state machines, permissions, Worker Protocol
semantics or schema history.

## Deployment acceptance

Before AWS may become ACTIVE:

-   infrastructure deploy succeeds from documented pipeline;
-   migrations are compatible with the declared release window;
-   health/readiness pass;
-   API contract suite passes;
-   backend conformance suite passes;
-   WSS reconnect/reconciliation tests pass;
-   Stripe test webhook/payment flow passes;
-   Google auth callback passes;
-   object upload/download passes;
-   full seller→Worker→sandbox/OpenClaw→result→ledger staging E2E
    passes;
-   restart/failure/retry scenarios preserve exactly-once effects.

## Durable asynchronous results --- AWS

This profile MUST satisfy all shared `ASYNC-*`. Durable buyer results
use the profile object-storage adapter, never local Node filesystem.
Job/result correctness survives process restart. `ASYNC-GOLD-001..010`
pass unchanged; provider mechanics cannot weaken retention,
authorization, finalization or retrieval.

## Buyer Experience parity --- AWS

This profile MUST satisfy `BUYERUX-*` through shared Core behavior.
Provider mechanics may affect observed timing, but
quote/deadline/cancel/expiry/progress/result/privacy/reliability
semantics remain identical. The profile passes all applicable
`BUYERUX-GOLD-*` unchanged.

## Seller Experience parity --- AWS

This profile MUST satisfy all `SELLERUX-*` shared semantics. Transport,
scheduler, storage and observability mechanics may differ, but seller
onboarding/readiness, capability policy, pause/capacity, health meaning,
economics, versioning/rollback, privacy, identity and Worker assignment
behavior remain provider-neutral. Applicable `SELLERUX-GOLD-*` scenarios
pass unchanged.
