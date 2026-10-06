# Kivro Architecture & Product Decisions

This is the durable decision log for implementation. It prevents coding
agents from silently reinterpreting settled product decisions.
`MASTER-SPEC.md` remains authoritative.

## Canonical decisions

### DEC-001 --- Kivro is runtime-independent as a brand

OpenClaw is the first supported seller runtime, not the permanent
product identity.

### DEC-002 --- Seller execution is isolated from personal OpenClaw

Paid jobs execute through the Kivro Worker in a separate minimal
OpenClaw environment. Buyers never access the seller's personal OpenClaw
session/workspace.

### DEC-003 --- Fail closed

No sandbox, incompatible runtime, critical security failure, or missing
required dependency means no paid execution. Never fall back to host
execution.

### DEC-004 --- Capabilities, not remote computer access

Buyers purchase narrow, typed, versioned capabilities. They do not
purchase arbitrary shell/browser/network access to seller machines.

### DEC-005 --- Explicit dependency consent

Every discovered skill/tool/resource/inference/network dependency must
be explicitly approved by the seller before publication.

### DEC-006 --- Controlled network access

Public research is mediated and policy-controlled.
Private/LAN/localhost/metadata access is blocked. Specialized
authenticated APIs use declared typed connectors.

### DEC-007 --- Payment before execution

No secured payment or reserved prepaid credits means no paid job
dispatch/execution. Settlement happens only after valid delivery.

### DEC-008 --- Fixed price tiers

MVP seller pricing uses Kivro-controlled fixed USD tiers with immutable
per-job price snapshots.

### DEC-009 --- Availability is independent from visibility

A capability may remain public/discoverable while scheduled offline.
Humans may schedule future execution; autonomous immediate execution
excludes future-only capabilities unless the buyer explicitly permits
waiting.

### DEC-010 --- Seller retains operational control

Seller can pause all new work and pause/cancel individual running jobs.
Local emergency pause must work without cloud connectivity and survive
restart.

### DEC-011 --- One authoritative I/O contract

The versioned capability I/O contract drives web forms, API validation,
agent mapping, Worker validation, file handling, and orchestration
compatibility.

### DEC-012 --- Versioned immutable publication

Runtime-affecting changes create a new capability version. Historical
jobs remain pinned to immutable snapshots.

### DEC-013 --- Platform inference and seller inference are separate

Kivro pays for Marketplace Agent inference. Seller capability inference
is an explicit seller dependency/cost.

### DEC-014 --- Human UI and autonomous orchestration use the same authoritative availability data

Human UI explains/schedules future availability. Autonomous immediate
mode hard-filters unavailable capabilities and continues searching
alternatives.

### DEC-015 --- UI quality is a product requirement

Kivro must use a restrained, intentional, human-designed visual system
and explicitly avoid stereotypical AI-generated SaaS aesthetics.

## Decision template

``` text
### DEC-NNN — Title
Date:
Status: Proposed | Accepted | Superseded
Context:
Decision:
Consequences:
Master Spec references:
```

Never use this log to override the Master Spec without explicit
user/product-owner approval.

### DEC-IMPL-001 --- Disable live personal-state skill listing until isolated

Date: 2026-10-06  
Status: Accepted implementation safeguard  
Context: On installed OpenClaw 2026.8.2, `skills list --json` attempted permission changes in the personal OpenClaw state during a supposed read-only scan. The local filesystem sandbox denied the writes. `OPENCLAW_CONFIG_READONLY=1` did not prevent the attempt.  
Decision: The live Kivro command allowlist contains only `--version`. Config and skill output parsers remain fixture-tested, but cannot be invoked against personal state. Future discovery must run through a pinned, proven isolated read-only path and demonstrate that personal config/state bytes and metadata stay unchanged.  
Consequences: Seller skill discovery is incomplete and remains OPEN in coverage. No discovery-driven publish or execution path is enabled.  
Master Spec references: §§7.2–7.4, 13.1, 57–59; DEC-002, DEC-003, DEC-005.

## DEC-LOCAL-001 --- Docker Compose local infrastructure

PostgreSQL, Redis and S3-compatible storage run locally through Docker
Compose; host installs are not required.

## DEC-LOCAL-002 --- Host-native Worker

Kivro Worker runs directly on the developer Mac during integration/E2E
development to exercise the real seller-device boundary.

## DEC-LOCAL-003 --- Real sandbox semantics locally

Development never bypasses sandboxing. Sandbox unavailable means
execution unavailable.

## DEC-LOCAL-004 --- S3-compatible local storage

Use MinIO or equivalent locally through the same storage
abstraction/business flow used for production storage.

## DEC-LOCAL-005 --- Two payment development modes

Use a deterministic fake adapter for fast tests and Stripe test mode for
Stripe acceptance; development shortcuts cannot be enabled in
production.

## DEC-LOCAL-006 --- Distinct buyer and seller identities

Even on one Mac, buyer and seller remain separate Kivro authorization
identities.

## DEC-LOCAL-007 --- Fresh-clone E2E is an engineering acceptance fixture

Maintain a reproducible buyer-to-seller local E2E path including
generated-file delivery and ledger settlement.

## DEC-AUTH-001 --- Kivro supports email/password and Google authentication

Both are MVP authentication methods and resolve to the same Kivro
user/account model.

## DEC-AUTH-002 --- Email ownership is mandatory for first-party accounts

Email/password users must verify their email before sensitive, paid,
seller, payout, or API-key actions.

## DEC-AUTH-003 --- Google login is identity-only

Google login requests only authentication identity scopes. Google Drive
or other Google product permissions are separate integrations with
separate consent.

## DEC-AUTH-004 --- Verified identities converge on one Kivro account

Kivro prevents duplicate accounts across email/password and Google when
identity can be linked safely through authoritative verified
email/provider identity. Account linking must fail closed when identity
cannot be established safely.

## Netsons production decisions

### DEC-NET-001 --- Pro Business baseline

The Netsons variant targets Pro Business because it provides the managed
Node.js, PostgreSQL, Redis, cron and developer-access capabilities
required by this profile.

### DEC-NET-002 --- No arbitrary persistent cloud daemons

Do not depend on manually started persistent daemons. Use only
hosting-managed Node applications plus cron.

### DEC-NET-003 --- PostgreSQL is the durable work queue

Jobs and asynchronous work are durable PostgreSQL state. WebSocket and
Redis are signaling/optimization layers.

### DEC-NET-004 --- No BullMQ production dependency

No persistent BullMQ consumer is required in production. Retries and
maintenance use durable PostgreSQL work plus bounded cron.

### DEC-NET-005 --- WSS remains primary Worker transport

The seller Worker uses WSS for immediate dispatch with mandatory
reconnect/reconciliation.

### DEC-NET-006 --- Minimize Node app count

Prefer one managed Node application for Web/API/WSS in the MVP unless
real Netsons testing proves another topology useful.

### DEC-NET-007 --- Durable assets use object storage

Use S3-compatible storage for durable buyer/seller assets and
direct/presigned transfers for large files.

### DEC-NET-008 --- Process restart is normal

Every cloud workflow must remain correct across managed Node process
restart.

### DEC-NET-009 --- Real Netsons staging test is mandatory

Documentation compatibility is not final acceptance; the purchased
account must pass the smoke tests and E2E.

## DEC-PORT-001 --- Worker is infrastructure-independent

The public Worker depends on the Kivro Worker Protocol and stable Kivro
discovery, never on Netsons/AWS-specific infrastructure.

## DEC-PORT-002 --- Executions retain origin ownership while draining

An execution remains owned by the control plane that leased it until
terminal state or an explicit tested transfer.

## DEC-PORT-003 --- Dual-backend coexistence is a supported continuity mode

Old backend drains owned work while new backend exclusively receives new
dispatches.

## DEC-PORT-004 --- Infrastructure location is independent from Worker upgrades

Moving Kivro Cloud normally requires neither seller reinstall, re-pair
nor binary update.

## DEC-PORT-005 --- Worker Protocol is transport-independent

Kivro Worker Protocol semantics live above connectivity. Polling and
WebSocket are adapters, not separate Worker implementations.

## DEC-PORT-006 --- Mixed transports may coexist per Worker

A single Worker may concurrently use different transport adapters for
different `controlPlaneId` values while execution ownership keeps
traffic isolated.

## DEC-PORT-007 --- Transport changes never change business semantics

Switching between polling and WebSocket cannot change authorization,
lease ownership, idempotency, payment, settlement, capability
permissions or result semantics.

## DEC-UNI-001 --- One backend core, two deployment profiles

Kivro has one shared TypeScript/Node backend implementation. Netsons and
AWS are deployment/infrastructure profiles, not separate product
backends.

## DEC-UNI-002 --- Business logic cannot live in provider adapters

Provider adapters implement infrastructure ports only.
Domain/application/API/payment/security semantics belong to shared
packages.

## DEC-UNI-003 --- Parity is enforced mechanically

Shared contracts, conformance tests, dependency-boundary checks and CI
gates are the source of parity. Human/coding-agent memory to "update
both" is insufficient.

## DEC-UNI-004 --- One public API and one logical schema

Both profiles expose the same versioned public API and use one logical
PostgreSQL schema/migration history.

## DEC-UNI-005 --- Transport differs, protocol does not

Netsons may use polling and AWS may use WebSocket, but both carry the
same Kivro Worker Protocol semantics.

## DEC-UNI-006 --- Both profiles are first-class from greenfield start

The monorepo contains and tests both deployment profiles from the
beginning even if only one profile is initially operated in production.

## DEC-UNI-007 --- Provider transition is operational

Switching ACTIVE control plane is routing/state transition between
conformant deployments of the same Kivro application, not a
rewrite/migration between independent codebases.

## DEC-HARD-001 --- Architecture rules are executable

Documentation is insufficient to preserve the
shared-core/provider-adapter boundary. CI architecture fitness tests are
mandatory merge gates.

## DEC-HARD-002 --- Behavioral parity is proven with golden scenarios

Netsons and AWS must execute the same provider-neutral golden scenarios.
Provider-specific tests are additive.

## DEC-HARD-003 --- Ambiguous failures must converge

Distributed failure handling is designed around authoritative state,
idempotency and reconciliation. Fault injection must prove final
convergence and exactly-once financial effects.

## DEC-HARD-004 --- Compatibility is explicit and multi-dimensional

Cloud, Worker, protocol, API, schema and manifest versions are tracked
independently with declared compatibility ranges.

## DEC-HARD-005 --- Database rollout uses expand/deploy/contract

Schema changes must tolerate overlapping compatible cloud
releases/control planes and resumable backfills.

## DEC-HARD-006 --- Worker updates are signed and independent from provider switches

Infrastructure routing changes do not force binary updates. Actual
Worker releases use verified signed artifacts and staged/recoverable
rollout practices.

## DEC-HARD-007 --- Backups require restore evidence

Configured backups are not sufficient evidence of disaster recovery;
isolated restore tests and invariant checks are required.

## DEC-HARD-008 --- Releases are unified

Netsons and AWS deploy the same Kivro product release with profile
adapter revisions recorded in one machine-readable release manifest.

## DEC-ASYNC-001 --- Jobs outlive browser sessions

Browser connections are not part of job correctness.

## DEC-ASYNC-002 --- Kivro owns durable buyer delivery

Seller-local success is not buyer completion; Kivro finalizes outputs
before `COMPLETED`.

## DEC-ASYNC-003 --- Binary results use private object storage

PostgreSQL owns identity/state/metadata; private object storage owns
durable binaries.

## DEC-ASYNC-004 --- Retrieval is re-authorized

Download access is short-lived and regenerated only after authorization.

## DEC-ASYNC-005 --- Retention is shared product policy

Both provider adapters implement identical logical retention/cleanup
semantics.

## DEC-ASYNC-006 --- Notifications are advisory

Email/webhook failure never changes an authoritative completed result.

## DEC-BUYERUX-001 --- Buyer predictability is a Core contract

Quote, deadline, cancellation, wait/expiry, progress, results and
privacy semantics belong to shared Kivro Core, not deployment adapters.

## DEC-BUYERUX-002 --- Estimates are evidence-based, not promises by default

Kivro prefers ranges/unknown over false precision and distinguishes
estimates from explicit guarantees.

## DEC-BUYERUX-003 --- No indefinite paid waiting

Every queued/scheduled paid job has bounded waiting/start-expiry
semantics and a deterministic release/refund path.

## DEC-BUYERUX-004 --- Historical jobs are immutable evidence

Input and capability/purchase snapshots explain exactly what was
authorized and executed; reruns create new jobs.

## DEC-BUYERUX-005 --- Seller receives minimum buyer identity

Worker jobs are pseudonymous by default; identity/profile/payment data
is withheld unless explicitly required and disclosed.

## DEC-BUYERUX-006 --- Result UX is semantic

Kivro uses versioned output contracts for named deliverables, previews
and safe bulk download instead of treating every result as opaque files.

## DEC-BUYERUX-007 --- Problem reporting is not implicit escrow

Buyer acknowledgement/problem reporting is durable support evidence;
financial remediation follows explicit audited policy.

## DEC-SELLERUX-001 --- Safe seller complexity is translated, not removed

Kivro keeps strict machine policy while presenting guided human
decisions.

## DEC-SELLERUX-002 --- Discovery is never consent

Local discovery is read-only/suggestion-only; exposure always requires
explicit seller selection.

## DEC-SELLERUX-003 --- AI assists but cannot authorize

AI may draft capability configuration but deterministic policy plus
seller consent controls permissions, secrets, pricing and publication.

## DEC-SELLERUX-004 --- Profit protection is product behavior

Seller-funded provider cost visibility/guardrails are part of safe
selling, not optional analytics.

## DEC-SELLERUX-005 --- Operational health is explainable

Unavailable/auto-paused states expose deterministic reasons and
remediation.

## DEC-SELLERUX-006 --- Published versions and historical jobs remain immutable

Rollback changes eligibility for new jobs only.

## DEC-SELLERUX-007 --- Marketplace identity and KYC identity are separate concerns

Public display identity does not automatically expose private legal
payout identity.

## DEC-SELLERUX-008 --- Seller is not structurally one machine

Core schema/contracts support explicit Worker identity/assignment from
greenfield.
