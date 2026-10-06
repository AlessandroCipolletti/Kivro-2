# Generation Report

-   Master sections parsed: **550**
-   Requirements generated: **1672**
-   Sections without requirement coverage: **0**
-   Master SHA-256:
    `0c229e9944e24b5bfca001350e1ed583bff7af77ae4703a24690a57630d3210b`

`MASTER-SPEC.md` is a byte-for-byte copy of the supplied Kivro master
plan.

Note: the requirement catalog is a traceability/execution layer, not a
replacement for reading the source sections.

## Local development specification update

Added MASTER-SPEC §§551--573, 29 curated DEV-LOCAL requirements,
milestone M18, local-development decisions, coverage rows and Codex
operating instructions for Docker Compose PostgreSQL/Redis/MinIO,
host-native Worker, real sandbox/OpenClaw E2E, one-command bootstrap,
demo mode, payment testing and fresh-clone acceptance.

## Authentication specification update

Added MASTER-SPEC §§574--580 and 24 curated AUTH requirements covering
verified email/password authentication, Google OAuth/OIDC, secure
account linking/deduplication, password reset, authentication security,
UX, local development and E2E acceptance.

## Netsons variant --- 2026-10-06T10:44:45+00:00

Added MASTER-SPEC §§581--607, 31 HOST-NET requirements, M19, nine
Netsons architecture decisions, deployment documentation and Codex
precedence rules.

## Backend portability design update --- 2026-10-06T10:56:12+00:00

Added 12 master-spec sections, 18 PORT requirements, migration
milestone, agent invariants and architecture decisions for zero-touch
dual-backend continuity.

## Transport abstraction update

Added PORT-019 through PORT-030 plus protocol, decision, agent and E2E
requirements so polling and WebSocket are interchangeable transports of
one Worker Protocol and may coexist against different control planes.

## Unified greenfield consolidation

This package supersedes the separate Netsons/AWS implementation-plan
model.

It preserves the original Kivro
product/security/payment/Worker/sandbox/research requirements and the
Netsons/portability additions, then adds:

-   one shared TypeScript/Node Kivro backend;
-   two first-class infrastructure/deployment profiles;
-   24 `ARCH-UNI-*` requirements;
-   shared ports/adapters architecture;
-   one public API contract;
-   one logical PostgreSQL schema/migration history;
-   mandatory backend conformance suite;
-   CI parity/architecture gates;
-   polling baseline for Netsons and WSS baseline for AWS;
-   simultaneous mixed-transport control-plane transition acceptance;
-   dedicated monorepo and conformance documents.

The plan remains greenfield: it describes what to build from zero and
does not assume an existing Kivro codebase.

## v2 engineering hardening

Added 28 `HARD-*` requirements and executable controls for architecture
fitness, golden cross-provider scenarios, fault injection/convergence,
version compatibility, expand/deploy/contract schema evolution, signed
Worker updates, disaster recovery/restore testing, threat-control-test
evidence, performance envelopes, unified release manifests, provider
parity reporting and milestone completion discipline. No commercial
product scope was intentionally added.

## v3 durable asynchronous delivery extension

Added 30 `ASYNC-*` requirements, M29, ten cross-provider golden
scenarios, durable My Jobs/results, Kivro-controlled output
finalization, private retained files, later authorized downloads,
retention/cleanup, notifications, fault/security/release/compatibility
evidence, identical Netsons/AWS semantics.

## v4 Buyer Experience extension

Added 45 `BUYERUX-*` requirements covering requested points 1--6 and
8--24 (point 7 intentionally excluded), 18 cross-provider golden
scenarios, milestones M30--M31, buyer privacy/data minimization,
preflight/quote/deadline/cancel/expiry, durable progress/ETA,
reliability, rich results/history/reuse, retention/problem UX and
operational buyer dashboard.

## v5 Seller Experience extension

Added 41 `SELLERUX-*` requirements implementing the explicitly selected
seller UX points: 1--7, 10--15, 17--18, 20--23, 25, 27--32, 34--35,
38--40. Added 21 cross-provider golden scenarios, milestones M32--M34,
and dedicated Seller Experience specification. Unselected seller
suggestions were not promoted into this extension.
