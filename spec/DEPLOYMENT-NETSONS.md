# Kivro --- Netsons Deployment Profile

This is a parallel variant of the canonical Kivro specification for
deploying the Kivro Cloud MVP on **Netsons Pro Business**.

## Production topology

``` text
Internet
   |
Netsons LiteSpeed / CloudLinux
   |
Managed Kivro Node.js application
   |-- Next.js web
   |-- REST API
   |-- Worker WSS endpoint
   |
   |-- PostgreSQL  -> durable source of truth
   |-- Redis       -> non-durable cache/coordination
   |-- S3 storage  -> durable assets
   |
   +-- cron        -> bounded durable-work processors

Seller computer
   |
Kivro Worker (Node/TypeScript)
   |
OpenClaw
   |
Docker sandbox
```

## Critical adaptation from the canonical architecture

The Netsons profile does **not** depend on arbitrary persistent
cloud-side daemons or BullMQ consumers.

``` text
Durable jobs/work: PostgreSQL
Immediate dispatch: WSS
Cache/realtime hints: Redis
Retries/maintenance: cron
Large files: S3-compatible object storage
```

A WebSocket message is only a wake-up/signal. The durable job exists in
PostgreSQL first.

See MASTER-SPEC §§581--607 for authoritative requirements.

## Worker transport profile

For this greenfield Netsons deployment, implement Worker control traffic
using the shared Kivro Worker Protocol over HTTPS polling where
persistent WebSocket operation is not selected/required by the hosting
profile.

Polling is a transport adapter only. Do not implement Netsons-specific
job semantics inside it. The same Worker binary/core must also support
the WebSocket adapter so another authorized control plane can use WSS
concurrently without reinstalling or re-pairing the seller Worker.

The Netsons control plane must advertise its selected transport through
Kivro service discovery and remain compatible with the mixed-transport
continuity tests in the master specification.

## Unified-monorepo precedence

This profile deploys the shared Kivro backend. It MUST NOT own
duplicated business logic. Where older wording suggests a
Netsons-specific application implementation or WSS baseline, the unified
Master Spec overrides it: Netsons baseline Worker connectivity is HTTPS
polling through the shared Worker Protocol transport interface.

## Durable asynchronous results --- Netsons

This profile MUST satisfy all shared `ASYNC-*`. Durable buyer results
use the profile object-storage adapter, never local Node filesystem.
Job/result correctness survives process restart. `ASYNC-GOLD-001..010`
pass unchanged; provider mechanics cannot weaken retention,
authorization, finalization or retrieval.

## Buyer Experience parity --- Netsons

This profile MUST satisfy `BUYERUX-*` through shared Core behavior.
Provider mechanics may affect observed timing, but
quote/deadline/cancel/expiry/progress/result/privacy/reliability
semantics remain identical. The profile passes all applicable
`BUYERUX-GOLD-*` unchanged.

## Seller Experience parity --- Netsons

This profile MUST satisfy all `SELLERUX-*` shared semantics. Transport,
scheduler, storage and observability mechanics may differ, but seller
onboarding/readiness, capability policy, pause/capacity, health meaning,
economics, versioning/rollback, privacy, identity and Worker assignment
behavior remain provider-neutral. Applicable `SELLERUX-GOLD-*` scenarios
pass unchanged.
