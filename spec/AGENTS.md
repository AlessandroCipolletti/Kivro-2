# AGENTS.md --- Kivro Engineering Contract

## Greenfield implementation invariant

This specification describes a **greenfield Kivro implementation**.
Assume no Kivro application code, database schema, deployed backend,
Worker binary, production infrastructure, or prior Kivro implementation
exists when work begins.

Instructions in this package describe the target system to build from
zero. They must not be interpreted as requests to refactor, replace,
remove, migrate, or preserve a pre-existing Kivro implementation.

References to prior/old/new states are valid only when they describe
runtime product behavior that the finished system must support (for
example capability versions, job history, database schema evolution, or
simultaneous ACTIVE/DRAINING control planes).

If an implementation milestone depends on another milestone, that
dependency refers only to artifacts created earlier while executing this
same greenfield plan.

## Authority

`spec/MASTER-SPEC.md` is the authoritative product and technical
specification.

Supporting files:

-   `spec/REQUIREMENTS.md` --- traceable requirement catalog.
-   `spec/IMPLEMENTATION-PLAN.md` --- implementation sequencing.
-   `spec/COVERAGE.md` --- living implementation/test evidence.
-   `spec/DECISIONS.md` --- durable accepted implementation decisions.

If a supporting file conflicts with `MASTER-SPEC.md`, follow
`MASTER-SPEC.md` and repair the supporting file.

## Core instruction

Do not optimize for finishing quickly by reducing scope. Completeness,
correctness, security and traceability have priority over implementation
speed.

Never silently omit, simplify, reinterpret, postpone or replace a
requirement because it is difficult. If blocked, mark it `BLOCKED`,
explain why, and continue only where safe.

## Before implementing a milestone

1.  Read the milestone in `spec/IMPLEMENTATION-PLAN.md`.
2.  Read every referenced Master Spec section.
3.  Read every mapped requirement.
4.  When implementing a milestone, inspect the code and tests created by
    earlier milestones before extending them.
5.  Produce or update a concrete task checklist.
6.  Identify security/payment/data-loss risks before implementation.

## During implementation

-   Keep `spec/COVERAGE.md` synchronized with actual evidence.
-   Use production implementations for required MVP behavior; mocks
    belong only in tests/dev fixtures.
-   Never weaken security boundaries to make a feature work.
-   Never fall back from required isolation to host execution.
-   Keep financial transitions idempotent and auditable.
-   Keep state-machine transitions explicit.
-   Validate structured inputs/outputs at trust boundaries.
-   Treat buyer inputs, uploaded files, URLs, web content, seller
    plugins and remote responses as untrusted.
-   Preserve immutable historical job/version/price/permission
    snapshots.
-   Prefer deterministic policy code over LLM judgment for security,
    money, availability, authorization and budgets.
-   Do not expose chain-of-thought, secrets, private seller paths,
    credentials, LAN details or personal OpenClaw data.

## UI implementation

UI quality is part of Definition of Done. Follow the Master Spec design
sections. Do not ship generic AI-generated SaaS aesthetics, untouched
component-library defaults, decorative gradients/glows, unnecessary
cards, or vague AI copy.

Review rendered pages, not only source code. Check desktop and mobile,
realistic data, loading/error/empty/long-content states, keyboard access
and responsive behavior.

## Required validation after a meaningful implementation unit

Run the relevant subset of:

``` text
unit tests
integration tests
E2E tests
typecheck
lint
build
security/adversarial tests
```

Do not mark a requirement `TESTED` unless an actual test or explicit
reproducible verification exists.

## Coverage rules

For each completed requirement, record:

``` text
status
implementation file(s)
test/evidence file(s)
notes if needed
```

A section-level coverage requirement is not satisfied merely because one
sentence from that section was implemented. Re-read the entire source
section before marking it complete.

`DEFERRED` is allowed only for functionality explicitly identified by
the Master Spec as post-MVP, or after explicit product-owner approval.

## Reviewer mode

After each milestone, perform a fresh adversarial review with this
objective:

> Attempt to prove the milestone is incomplete, unsafe, inconsistent
> with the Master Spec, or insufficiently tested.

Check the original Master Spec rather than trusting `COVERAGE.md`. Fix
discovered gaps before closing the milestone.

## Final compliance audit

Before declaring Kivro complete:

1.  Re-read the entire `MASTER-SPEC.md`.
2.  Independently audit the repository against it.
3.  For every requirement classify `PASS`, `PARTIAL`, `FAIL`,
    `NOT_IMPLEMENTED`, or `UNTESTED`.
4.  Do not trust coverage claims without code/test evidence.
5.  Search for Master Spec sections with no implementation evidence.
6.  Run the full automated test suite, typecheck, lint and production
    build.
7.  Run the canonical paid staging E2E between two distinct users.
8.  Verify the seller's personal OpenClaw environment remains untouched.
9.  Verify payment/settlement happens exactly once.
10. Verify no unexplained required-MVP item remains.

The project is not complete because the happy path works. It is complete
only when the Master Spec is accounted for end-to-end.

## Local development contract

Local development is a first-class acceptance target. Preserve
`pnpm dev:setup`, Docker Compose PostgreSQL/Redis/S3-compatible storage,
host-native Worker execution, distinct buyer/seller identities, real
sandbox semantics, strict environment-gating of development payment/auth
shortcuts, Stripe test-mode coverage and `pnpm test:e2e:local`. Never
create a development shortcut that weakens the production security
model. Before marking infrastructure-related work complete, verify
MASTER-SPEC §§551--573 and update all `DEV-LOCAL-*` coverage rows.

## Authentication implementation contract

When changing authentication or account identity:

1.  Preserve both email/password and Google sign-in.
2.  Do not allow unverified first-party email identities to perform
    sensitive/paid actions.
3.  Never create duplicate Kivro accounts merely because the user
    switches between safely linkable authentication methods.
4.  Never auto-link an account from an unverified email claim.
5.  Keep Google login scopes limited to identity; Google Drive
    authorization is a separate integration.
6.  Never log passwords, verification/reset tokens, OAuth tokens or
    session secrets.
7.  Keep development auth shortcuts strictly environment-gated and
    impossible in production.
8.  Update `AUTH-*` coverage and authentication E2E tests whenever auth
    behavior changes.

Before declaring M02 complete, verify MASTER-SPEC §§574--580 against the
actual implementation and tests.

## Netsons production profile

MASTER-SPEC §§581--607 are authoritative when infrastructure guidance
conflicts with earlier generic recommendations.

Never introduce a production dependency on BullMQ consumer daemons,
PM2/Supervisor/systemd, Docker on the Kivro cloud host, self-hosted
PostgreSQL/Redis/web servers, or arbitrary persistent background
processes.

Use PostgreSQL for durable state, WSS for immediate Worker signaling,
Redis only for non-durable optimization/coordination, and bounded
idempotent cron for deferred/retry work.

Before marking deployment complete, run the real Netsons smoke test and
staging E2E. Do not mark a hosting capability verified merely because it
works locally.

## Backend portability invariant

Never bind the distributed Kivro Worker to Netsons, AWS, a physical
hostname/server, or deployment-specific credential.

Preserve `PORT-001` through `PORT-018`: stable Kivro discovery,
versioned protocol, portable Worker identity, explicit per-execution
control-plane ownership, ACTIVE/DRAINING/RETIRED control-plane states,
idempotent dual-backend coexistence and zero-touch backend transition.

Never implement a shortcut requiring installed sellers to reinstall or
re-pair solely because Kivro Cloud changes provider.

## Transport abstraction invariant

Do not put job/business state-machine logic inside the polling or
WebSocket adapter.

Implement a shared Worker Protocol/core and transport adapters behind a
narrow interface. The same execution, lease, reconciliation, permission
and financial invariants must hold regardless of transport.

The Worker must be capable of polling one control plane while
maintaining WSS to another. Always scope transport sessions and
execution traffic by `controlPlaneId`; never route an old execution
through another control plane merely because its transport is currently
preferred.

Do not hard-code Netsons == polling or AWS == WebSocket in domain logic.
Deployment profiles may choose those transports, but the protocol
architecture remains provider- and transport-independent.

## Unified monorepo rule --- mandatory for every Codex task

There is ONE Kivro backend application and TWO infrastructure/deployment
profiles. Never create two independent copies of application behavior.

Before changing backend code, classify the request:

-   **Shared behavior:**
    domain/application/API/schema/auth/payment/job/security/Worker
    Protocol behavior. Implement ONCE in shared packages.
-   **Infrastructure mechanics:** provider-specific
    queue/scheduler/realtime/storage/hosting/deployment behavior.
    Implement behind an existing/new shared port in the relevant
    adapter(s).

If a task appears to require copying a use case into both
`cloud-netsons` and `cloud-aws`, stop and refactor the design so the use
case is shared.

### Mandatory completion procedure for backend-affecting changes

1.  Read the relevant Master Spec requirements.
2.  Identify shared vs adapter-specific impact.
3.  Update shared contracts first when semantics change.
4.  Implement shared behavior once.
5.  Update Netsons/AWS adapters only where infrastructure mechanics
    require it.
6.  Run shared unit/integration tests.
7.  Run the backend conformance suite against BOTH composition roots.
8.  Run affected Netsons profile tests.
9.  Run affected AWS profile tests.
10. Run API contract/schema drift checks.
11. Update `COVERAGE.md` with evidence for both profiles.
12. Do not mark DONE if either supported profile is broken, behaviorally
    divergent, or untested.

The fact that only one provider is currently deployed is never
permission to leave the other profile incompatible.

### Dependency rule

Shared packages MUST NOT import provider-specific packages. Composition
roots depend inward on shared application code and outward on adapters;
shared business code does not depend outward on Netsons/AWS.

### Bug-fix rule

A bug observed on one provider does not imply the fix belongs in that
provider adapter. Locate the semantic owner first. If the defect is in
shared behavior, fix it once and add a regression test that runs against
both profiles.

### API/schema rule

Never hand-maintain two public API definitions or two logical database
schemas. Generate/use one shared contract and one migration history.

### Parity rule

"Implemented on Netsons; AWS TODO" or the reverse is BLOCKED/INCOMPLETE
for any P0/P1/P2 shared behavior requirement unless the Master Spec
explicitly declares a provider-only operational feature.

### Architecture review trigger

Any proposal to duplicate domain/application logic, introduce a second
backend language, fork the database schema, fork the public API, or
bypass the conformance matrix requires an explicit new decision in
`DECISIONS.md` and must preserve all Master Spec invariants.

## Engineering hardening rules --- mandatory

For every backend-affecting task, Codex MUST treat architecture tests,
both-provider conformance and coverage evidence as part of the
implementation, not optional cleanup.

When adding/changing behavior:

1.  identify the semantic owner;
2.  prefer one shared implementation;
3.  update shared contracts/versioning when observable semantics change;
4.  update only infrastructure adapters whose mechanics change;
5.  add/extend a golden scenario for material behavior;
6.  add a regression/fault test when fixing a distributed-state bug;
7.  run architecture fitness tests;
8.  run conformance against Netsons and AWS;
9.  verify schema/protocol compatibility window;
10. update `COVERAGE.md` and generated parity evidence.

### Forbidden completion shortcuts

Do not mark a task DONE by:

-   duplicating shared logic in both adapters;
-   testing only the currently deployed provider;
-   weakening a conformance assertion to make one provider pass;
-   bypassing sandbox/payment/idempotency/security in local/staging
    mode;
-   making a destructive schema change without compatibility staging;
-   forcing Worker update/re-pairing to compensate for a backend design
    problem;
-   treating configured backups as tested recovery;
-   documenting a threat without adding/verifying its control evidence
    when implementation is in scope.

### Milestone DONE template

Before marking any milestone DONE, record: Preconditions satisfied;
Deliverables present; Forbidden shortcuts absent; Required tests
passing; Coverage/evidence updated; Exit criteria proven.

## Durable async/result rule

For job/scheduling/asset/notification/Worker-completion/result changes
preserve: **buyer-visible completion means Kivro has durably finalized
declared deliverables; browser presence and seller Worker presence after
finalization are irrelevant to later authorized retrieval.** Run
`ASYNC-GOLD-001..010` against both profiles for affected changes. Never
implement result behavior only for the currently active provider.

## Buyer Experience invariants

Buyer UX is backed by shared Core semantics, never UI-only assumptions.
Any change to quote, deadline, cancellation, scheduling, progress, ETA,
history, result rendering, retention, reliability, privacy or dashboard
must preserve `BUYERUX-*` and run the affected `BUYERUX-GOLD-*` against
both deployment roots.

Do not optimize the currently active provider by weakening parity. Never
invent progress/ETA. Never forward buyer profile data to Worker for
convenience. Historical jobs are immutable; reuse creates new jobs.

## Seller Experience invariants

Seller UX is shared Core behavior, not deployment-specific polish.
Preserve explicit seller consent, secret locality, deterministic
publish/health rules, immutable published versions, authoritative
financial state, provider-cost guardrails, buyer-data minimization and
future multi-Worker structure.

AI-generated seller configuration is never authorization. Discovery is
never exposure. Worker-reported earnings are never financial truth. Run
affected `SELLERUX-GOLD-*` against both deployment roots.
