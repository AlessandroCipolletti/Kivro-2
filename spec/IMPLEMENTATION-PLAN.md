# Kivro Implementation Plan for Codex

## Greenfield starting condition

Begin from an empty/new Kivro codebase. Create all application
structure, schemas, services, Worker components, tests, deployment
configuration and infrastructure described by this plan. No milestone
assumes a previously deployed Kivro system.

> Execute milestones in order unless dependencies explicitly permit
> parallel work. The Master Spec is authoritative; this file controls
> sequencing, not scope.

## Global Definition of Done

A milestone is complete only when:

1.  Every mapped requirement is classified in `COVERAGE.md`.
2.  Required production behavior is implemented; mocks are not accepted
    as production substitutes.
3.  Unit/integration/E2E tests appropriate to the milestone pass.
4.  Typecheck and lint pass.
5.  Security invariants are not weakened.
6.  Relevant UI is reviewed at desktop and mobile sizes.
7.  Any deviation is recorded in `DECISIONS.md` and must not contradict
    the Master Spec.

### Cross-system verification sequencing

Some early milestones map acceptance gates whose real tests require
components introduced by later milestones. Keep every mapped requirement
and its original acceptance criterion. A milestone's *implementation work*
may unblock the next milestone when all work possible with its current
dependencies is implemented and validated. This does not close its
cross-system gates.

Mark such rows `DEFERRED_VERIFICATION` in `COVERAGE.md` and record, for
each ID, the missing dependency and exact closing evidence in
`docs/verification-backlog.md`. This status is OPEN, never equivalent to
`TESTED` or `VERIFIED`; it may also mean dependent implementation is
still absent. At every later milestone, review the backlog and execute
any gate whose missing dependency has arrived. A gate becomes `VERIFIED`
only when its real required evidence exists. The final project audit
requires zero unresolved mandatory requirements and zero unresolved
mandatory deferred verification gates.

This sequencing rule resolves early mapping/dependency conflicts; it
does not defer product scope or weaken the original acceptance gates.

For implementation runs, follow the product owner's one-milestone rule:
finish the requested milestone's implementable work and current validation,
update its open verification backlog, then stop before starting the next
milestone. An implementation-stage boundary does not assert full closure of
cross-system acceptance gates.

## Milestones

### M00 --- Repository bootstrap & engineering contract

-   **Master Spec coverage:** §40, §49, §51, §52, §53, §54, §55, §56,
    §57, §58, §59, §60, §84, §85, §86, §87, §88, §89, §90, §91, §92,
    §93, §94, §95
-   **Requirements:** 77 mapped requirements
-   **Depends on:** none

**Execution checklist**

-   Read the mapped Master Spec sections before coding.
-   Establish the required repository structure for this milestone, then
    inspect any code/tests produced by earlier milestones before
    extending them.
-   Convert the milestone into a concrete task checklist before edits.
-   Implement in small, testable increments.
-   Update `COVERAGE.md` as evidence is created.
-   Run relevant tests/typecheck/lint.
-   Perform adversarial review for security/payment/runtime milestones.
-   Do not silently defer mapped requirements.

**Acceptance gate**

-   All 77 mapped requirements are accounted for.
-   No unexplained `TODO`, `PARTIAL`, or `BLOCKED` item remains for
    functionality required by this milestone.
-   Evidence paths and test paths are recorded in `COVERAGE.md`.

### M01 --- Domain model, accounts & shared contracts

-   **Master Spec coverage:** §4, §8, §9, §23, §53, §54, §120, §163,
    §192, §299, §300, §301, §302, §303, §304, §305, §306, §307, §308
-   **Requirements:** 64 mapped requirements
-   **Depends on:** earlier milestones only where their specified
    outputs are prerequisites dependencies

**Execution checklist**

-   Read the mapped Master Spec sections before coding.
-   Establish the required repository structure for this milestone, then
    inspect any code/tests produced by earlier milestones before
    extending them.
-   Convert the milestone into a concrete task checklist before edits.
-   Implement in small, testable increments.
-   Update `COVERAGE.md` as evidence is created.
-   Run relevant tests/typecheck/lint.
-   Perform adversarial review for security/payment/runtime milestones.
-   Do not silently defer mapped requirements.

**Acceptance gate**

-   All 64 mapped requirements are accounted for.
-   No unexplained `TODO`, `PARTIAL`, or `BLOCKED` item remains for
    functionality required by this milestone.
-   Evidence paths and test paths are recorded in `COVERAGE.md`.

### M02 --- Kivro Worker foundation & OpenClaw integration

-   **Master Spec coverage:** §5, §6, §7, §10, §11, §12, §13, §14, §15,
    §20, §21, §22, §61, §62, §63, §64, §65, §66, §67, §68, §69, §369,
    §370, §371, §372 ... (+23 sections)
-   **Requirements:** 185 mapped requirements
-   **Depends on:** earlier milestones only where their specified
    outputs are prerequisites dependencies

**Execution checklist**

-   Read the mapped Master Spec sections before coding.
-   Establish the required repository structure for this milestone, then
    inspect any code/tests produced by earlier milestones before
    extending them.
-   Convert the milestone into a concrete task checklist before edits.
-   Implement in small, testable increments.
-   Update `COVERAGE.md` as evidence is created.
-   Run relevant tests/typecheck/lint.
-   Perform adversarial review for security/payment/runtime milestones.
-   Do not silently defer mapped requirements.

**Acceptance gate**

-   All 185 mapped requirements are accounted for.
-   No unexplained `TODO`, `PARTIAL`, or `BLOCKED` item remains for
    functionality required by this milestone.
-   Evidence paths and test paths are recorded in `COVERAGE.md`.

### M03 --- Capability import, dependencies & publishing

-   **Master Spec coverage:** §96, §97, §98, §99, §100, §101, §102,
    §103, §104, §105, §106, §107, §108, §109, §110, §111, §112, §113,
    §114, §115, §116, §117, §118, §119, §309 ... (+47 sections)
-   **Requirements:** 207 mapped requirements
-   **Depends on:** earlier milestones only where their specified
    outputs are prerequisites dependencies

**Execution checklist**

-   Read the mapped Master Spec sections before coding.
-   Establish the required repository structure for this milestone, then
    inspect any code/tests produced by earlier milestones before
    extending them.
-   Convert the milestone into a concrete task checklist before edits.
-   Implement in small, testable increments.
-   Update `COVERAGE.md` as evidence is created.
-   Run relevant tests/typecheck/lint.
-   Perform adversarial review for security/payment/runtime milestones.
-   Do not silently defer mapped requirements.

**Acceptance gate**

-   All 207 mapped requirements are accounted for.
-   No unexplained `TODO`, `PARTIAL`, or `BLOCKED` item remains for
    functionality required by this milestone.
-   Evidence paths and test paths are recorded in `COVERAGE.md`.

### M04 --- Sandbox, permissions & security baseline

-   **Master Spec coverage:** §16, §17, §18, §19, §20, §21, §70, §71,
    §72, §73, §74, §75, §76, §77, §78, §79, §80, §81, §82, §83, §278,
    §279, §280, §281, §282 ... (+16 sections)
-   **Requirements:** 145 mapped requirements
-   **Depends on:** earlier milestones only where their specified
    outputs are prerequisites dependencies

**Execution checklist**

-   Read the mapped Master Spec sections before coding.
-   Establish the required repository structure for this milestone, then
    inspect any code/tests produced by earlier milestones before
    extending them.
-   Convert the milestone into a concrete task checklist before edits.
-   Implement in small, testable increments.
-   Update `COVERAGE.md` as evidence is created.
-   Run relevant tests/typecheck/lint.
-   Perform adversarial review for security/payment/runtime milestones.
-   Do not silently defer mapped requirements.

**Acceptance gate**

-   All 145 mapped requirements are accounted for.
-   No unexplained `TODO`, `PARTIAL`, or `BLOCKED` item remains for
    functionality required by this milestone.
-   Evidence paths and test paths are recorded in `COVERAGE.md`.

### M05 --- Capability I/O, files & assets

-   **Master Spec coverage:** §192, §193, §194, §195, §196, §197, §198,
    §199, §200, §201, §202, §203, §204, §205, §206, §207, §208, §209,
    §210, §211, §212, §213, §214, §215, §216 ... (+20 sections)
-   **Requirements:** 110 mapped requirements
-   **Depends on:** earlier milestones only where their specified
    outputs are prerequisites dependencies

**Execution checklist**

-   Read the mapped Master Spec sections before coding.
-   Establish the required repository structure for this milestone, then
    inspect any code/tests produced by earlier milestones before
    extending them.
-   Convert the milestone into a concrete task checklist before edits.
-   Implement in small, testable increments.
-   Update `COVERAGE.md` as evidence is created.
-   Run relevant tests/typecheck/lint.
-   Perform adversarial review for security/payment/runtime milestones.
-   Do not silently defer mapped requirements.

**Acceptance gate**

-   All 110 mapped requirements are accounted for.
-   No unexplained `TODO`, `PARTIAL`, or `BLOCKED` item remains for
    functionality required by this milestone.
-   Evidence paths and test paths are recorded in `COVERAGE.md`.

### M06 --- Controlled Internet research & resource brokers

-   **Master Spec coverage:** §237, §238, §239, §240, §241, §242, §243,
    §244, §245, §246, §247, §248, §249, §250, §251, §252, §253, §254,
    §255, §256, §257, §258, §259, §260, §261 ... (+16 sections)
-   **Requirements:** 106 mapped requirements
-   **Depends on:** earlier milestones only where their specified
    outputs are prerequisites dependencies

**Execution checklist**

-   Read the mapped Master Spec sections before coding.
-   Establish the required repository structure for this milestone, then
    inspect any code/tests produced by earlier milestones before
    extending them.
-   Convert the milestone into a concrete task checklist before edits.
-   Implement in small, testable increments.
-   Update `COVERAGE.md` as evidence is created.
-   Run relevant tests/typecheck/lint.
-   Perform adversarial review for security/payment/runtime milestones.
-   Do not silently defer mapped requirements.

**Acceptance gate**

-   All 106 mapped requirements are accounted for.
-   No unexplained `TODO`, `PARTIAL`, or `BLOCKED` item remains for
    functionality required by this milestone.
-   Evidence paths and test paths are recorded in `COVERAGE.md`.

### M07 --- Job execution, dispatch, recovery & per-job control

-   **Master Spec coverage:** §9, §10, §11, §12, §13, §14, §15, §426,
    §427, §428, §429, §430, §431, §432, §433, §434, §435, §436, §437,
    §438, §439, §440, §441, §442, §443 ... (+7 sections)
-   **Requirements:** 119 mapped requirements
-   **Depends on:** earlier milestones only where their specified
    outputs are prerequisites dependencies

**Execution checklist**

-   Read the mapped Master Spec sections before coding.
-   Establish the required repository structure for this milestone, then
    inspect any code/tests produced by earlier milestones before
    extending them.
-   Convert the milestone into a concrete task checklist before edits.
-   Implement in small, testable increments.
-   Update `COVERAGE.md` as evidence is created.
-   Run relevant tests/typecheck/lint.
-   Perform adversarial review for security/payment/runtime milestones.
-   Do not silently defer mapped requirements.

**Acceptance gate**

-   All 119 mapped requirements are accounted for.
-   No unexplained `TODO`, `PARTIAL`, or `BLOCKED` item remains for
    functionality required by this milestone.
-   Evidence paths and test paths are recorded in `COVERAGE.md`.

### M08 --- Payments, pricing & seller economics

-   **Master Spec coverage:** §24, §25, §278, §279, §280, §281, §282,
    §283, §284, §285, §286, §287, §288, §289, §290, §291, §292, §293,
    §294, §295, §296, §297, §298
-   **Requirements:** 137 mapped requirements
-   **Depends on:** earlier milestones only where their specified
    outputs are prerequisites dependencies

**Execution checklist**

-   Read the mapped Master Spec sections before coding.
-   Establish the required repository structure for this milestone, then
    inspect any code/tests produced by earlier milestones before
    extending them.
-   Convert the milestone into a concrete task checklist before edits.
-   Implement in small, testable increments.
-   Update `COVERAGE.md` as evidence is created.
-   Run relevant tests/typecheck/lint.
-   Perform adversarial review for security/payment/runtime milestones.
-   Do not silently defer mapped requirements.

**Acceptance gate**

-   All 137 mapped requirements are accounted for.
-   No unexplained `TODO`, `PARTIAL`, or `BLOCKED` item remains for
    functionality required by this milestone.
-   Evidence paths and test paths are recorded in `COVERAGE.md`.

### M09 --- Availability, scheduling, queueing & future reservations

-   **Master Spec coverage:** §26, §396, §397, §398, §399, §400, §401,
    §402, §403, §404, §405, §406, §407, §408, §409, §410, §411, §412,
    §413, §414, §415, §416, §417, §418, §419 ... (+43 sections)
-   **Requirements:** 150 mapped requirements
-   **Depends on:** earlier milestones only where their specified
    outputs are prerequisites dependencies

**Execution checklist**

-   Read the mapped Master Spec sections before coding.
-   Establish the required repository structure for this milestone, then
    inspect any code/tests produced by earlier milestones before
    extending them.
-   Convert the milestone into a concrete task checklist before edits.
-   Implement in small, testable increments.
-   Update `COVERAGE.md` as evidence is created.
-   Run relevant tests/typecheck/lint.
-   Perform adversarial review for security/payment/runtime milestones.
-   Do not silently defer mapped requirements.

**Acceptance gate**

-   All 150 mapped requirements are accounted for.
-   No unexplained `TODO`, `PARTIAL`, or `BLOCKED` item remains for
    functionality required by this milestone.
-   Evidence paths and test paths are recorded in `COVERAGE.md`.

### M10 --- Marketplace buyer experience & discovery

-   **Master Spec coverage:** §28, §29, §120, §121, §122, §123, §124,
    §125, §126, §127, §128, §129, §130, §131, §132, §133, §134, §135,
    §136, §137, §138, §139, §140, §141, §142 ... (+32 sections)
-   **Requirements:** 148 mapped requirements
-   **Depends on:** earlier milestones only where their specified
    outputs are prerequisites dependencies

**Execution checklist**

-   Read the mapped Master Spec sections before coding.
-   Establish the required repository structure for this milestone, then
    inspect any code/tests produced by earlier milestones before
    extending them.
-   Convert the milestone into a concrete task checklist before edits.
-   Implement in small, testable increments.
-   Update `COVERAGE.md` as evidence is created.
-   Run relevant tests/typecheck/lint.
-   Perform adversarial review for security/payment/runtime milestones.
-   Do not silently defer mapped requirements.

**Acceptance gate**

-   All 148 mapped requirements are accounted for.
-   No unexplained `TODO`, `PARTIAL`, or `BLOCKED` item remains for
    functionality required by this milestone.
-   Evidence paths and test paths are recorded in `COVERAGE.md`.

### M11 --- Marketplace Agent & platform inference

-   **Master Spec coverage:** §120, §121, §122, §123, §124, §125, §126,
    §127, §128, §129, §130, §131, §132, §133, §134, §135, §136, §137,
    §138, §139, §140, §141, §142, §143, §144 ... (+77 sections)
-   **Requirements:** 295 mapped requirements
-   **Depends on:** earlier milestones only where their specified
    outputs are prerequisites dependencies

**Execution checklist**

-   Read the mapped Master Spec sections before coding.
-   Establish the required repository structure for this milestone, then
    inspect any code/tests produced by earlier milestones before
    extending them.
-   Convert the milestone into a concrete task checklist before edits.
-   Implement in small, testable increments.
-   Update `COVERAGE.md` as evidence is created.
-   Run relevant tests/typecheck/lint.
-   Perform adversarial review for security/payment/runtime milestones.
-   Do not silently defer mapped requirements.

**Acceptance gate**

-   All 295 mapped requirements are accounted for.
-   No unexplained `TODO`, `PARTIAL`, or `BLOCKED` item remains for
    functionality required by this milestone.
-   Evidence paths and test paths are recorded in `COVERAGE.md`.

### M12 --- Seller dashboard, Worker health & emergency controls

-   **Master Spec coverage:** §369, §370, §371, §372, §373, §374, §375,
    §376, §377, §378, §379, §380, §381, §382, §383, §384, §385, §386,
    §387, §388, §389, §390, §391, §392, §393 ... (+57 sections)
-   **Requirements:** 218 mapped requirements
-   **Depends on:** earlier milestones only where their specified
    outputs are prerequisites dependencies

**Execution checklist**

-   Read the mapped Master Spec sections before coding.
-   Establish the required repository structure for this milestone, then
    inspect any code/tests produced by earlier milestones before
    extending them.
-   Convert the milestone into a concrete task checklist before edits.
-   Implement in small, testable increments.
-   Update `COVERAGE.md` as evidence is created.
-   Run relevant tests/typecheck/lint.
-   Perform adversarial review for security/payment/runtime milestones.
-   Do not silently defer mapped requirements.

**Acceptance gate**

-   All 218 mapped requirements are accounted for.
-   No unexplained `TODO`, `PARTIAL`, or `BLOCKED` item remains for
    functionality required by this milestone.
-   Evidence paths and test paths are recorded in `COVERAGE.md`.

### M13 --- Buyer REST API, API keys & webhooks

-   **Master Spec coverage:** §330, §331, §332, §333, §334, §335, §336,
    §337, §338, §339, §340, §341, §342, §343, §344, §345, §346, §347,
    §348, §349, §350, §351, §352, §353, §354 ... (+2 sections)
-   **Requirements:** 66 mapped requirements
-   **Depends on:** earlier milestones only where their specified
    outputs are prerequisites dependencies

**Execution checklist**

-   Read the mapped Master Spec sections before coding.
-   Establish the required repository structure for this milestone, then
    inspect any code/tests produced by earlier milestones before
    extending them.
-   Convert the milestone into a concrete task checklist before edits.
-   Implement in small, testable increments.
-   Update `COVERAGE.md` as evidence is created.
-   Run relevant tests/typecheck/lint.
-   Perform adversarial review for security/payment/runtime milestones.
-   Do not silently defer mapped requirements.

**Acceptance gate**

-   All 66 mapped requirements are accounted for.
-   No unexplained `TODO`, `PARTIAL`, or `BLOCKED` item remains for
    functionality required by this milestone.
-   Evidence paths and test paths are recorded in `COVERAGE.md`.

### M14 --- UI design system & product polish

-   **Master Spec coverage:** §518, §519, §520, §521, §522, §523, §524,
    §525, §526, §527, §528, §529, §530, §531, §532, §533, §534, §535,
    §536, §537, §538, §539, §540, §541, §542 ... (+8 sections)
-   **Requirements:** 96 mapped requirements
-   **Depends on:** earlier milestones only where their specified
    outputs are prerequisites dependencies

**Execution checklist**

-   Read the mapped Master Spec sections before coding.
-   Establish the required repository structure for this milestone, then
    inspect any code/tests produced by earlier milestones before
    extending them.
-   Convert the milestone into a concrete task checklist before edits.
-   Implement in small, testable increments.
-   Update `COVERAGE.md` as evidence is created.
-   Run relevant tests/typecheck/lint.
-   Perform adversarial review for security/payment/runtime milestones.
-   Do not silently defer mapped requirements.

**Acceptance gate**

-   All 96 mapped requirements are accounted for.
-   No unexplained `TODO`, `PARTIAL`, or `BLOCKED` item remains for
    functionality required by this milestone.
-   Evidence paths and test paths are recorded in `COVERAGE.md`.

### M15 --- Observability, abuse, privacy & operations

-   **Master Spec coverage:** §29, §30, §31, §32, §33, §34, §35, §36,
    §37, §38, §84, §85, §86, §87, §88, §89, §90, §91, §92, §93, §94, §95
-   **Requirements:** 53 mapped requirements
-   **Depends on:** earlier milestones only where their specified
    outputs are prerequisites dependencies

**Execution checklist**

-   Read the mapped Master Spec sections before coding.
-   Establish the required repository structure for this milestone, then
    inspect any code/tests produced by earlier milestones before
    extending them.
-   Convert the milestone into a concrete task checklist before edits.
-   Implement in small, testable increments.
-   Update `COVERAGE.md` as evidence is created.
-   Run relevant tests/typecheck/lint.
-   Perform adversarial review for security/payment/runtime milestones.
-   Do not silently defer mapped requirements.

**Acceptance gate**

-   All 53 mapped requirements are accounted for.
-   No unexplained `TODO`, `PARTIAL`, or `BLOCKED` item remains for
    functionality required by this milestone.
-   Evidence paths and test paths are recorded in `COVERAGE.md`.

### M16 --- Testing, fixtures, E2E & release gates

-   **Master Spec coverage:** §34, §35, §36, §37, §38, §39, §40, §41,
    §42, §43, §44, §45, §46, §88, §89, §90, §91, §92, §93, §94, §95
-   **Requirements:** 51 mapped requirements
-   **Depends on:** earlier milestones only where their specified
    outputs are prerequisites dependencies

**Execution checklist**

-   Read the mapped Master Spec sections before coding.
-   Establish the required repository structure for this milestone, then
    inspect any code/tests produced by earlier milestones before
    extending them.
-   Convert the milestone into a concrete task checklist before edits.
-   Implement in small, testable increments.
-   Update `COVERAGE.md` as evidence is created.
-   Run relevant tests/typecheck/lint.
-   Perform adversarial review for security/payment/runtime milestones.
-   Do not silently defer mapped requirements.

**Acceptance gate**

-   All 51 mapped requirements are accounted for.
-   No unexplained `TODO`, `PARTIAL`, or `BLOCKED` item remains for
    functionality required by this milestone.
-   Evidence paths and test paths are recorded in `COVERAGE.md`.

### M17 --- Full specification compliance audit

-   **Master Spec coverage:** §1, §2, §3, §4, §5, §6, §7, §8, §9, §10,
    §11, §12, §13, §14, §15, §16, §17, §18, §19, §20, §21, §22, §23,
    §24, §25 ... (+525 sections)
-   **Requirements:** 1672 mapped requirements
-   **Depends on:** earlier milestones only where their specified
    outputs are prerequisites dependencies

**Execution checklist**

-   Read the mapped Master Spec sections before coding.
-   Establish the required repository structure for this milestone, then
    inspect any code/tests produced by earlier milestones before
    extending them.
-   Convert the milestone into a concrete task checklist before edits.
-   Implement in small, testable increments.
-   Update `COVERAGE.md` as evidence is created.
-   Run relevant tests/typecheck/lint.
-   Perform adversarial review for security/payment/runtime milestones.
-   Do not silently defer mapped requirements.

**Acceptance gate**

-   All 1672 mapped requirements are accounted for.
-   No unexplained `TODO`, `PARTIAL`, or `BLOCKED` item remains for
    functionality required by this milestone.
-   Evidence paths and test paths are recorded in `COVERAGE.md`.

## M18 --- Local Development Environment & Full Local E2E

### Goal

Make Kivro reproducibly runnable on a supported developer Mac with
production-like local infrastructure and a real host-native Worker.

### Requirements covered

`DEV-LOCAL-001` through `DEV-LOCAL-029`, plus the storage and Worker
components specified by this plan, sandbox, payment, job and E2E
requirements participating in the local path.

### Required implementation

``` text
Docker Compose: PostgreSQL + Redis + MinIO/S3-compatible storage
pnpm dev:setup
pnpm dev
pnpm worker:dev
pnpm dev:demo
pnpm test:e2e:local
migrations + deterministic seed + bucket creation
host-native Worker + real Docker job sandbox + OpenClaw integration
fake dev payment adapter + Stripe test mode
distinct buyer/seller fixtures + correlated logs + health checks + reset commands
```

### Acceptance

Fresh clone → setup → local services → Worker → seller publishes fixture
capability → buyer discovers and test-pays → dispatch → sandbox/OpenClaw
→ output validation/upload → buyer result → seller ledger settles
exactly once. Development mode must not weaken security boundaries.
Every checkbox in MASTER-SPEC §573 must pass.

## Authentication scope addition --- M02

M02 Authentication & Accounts must explicitly implement `AUTH-001`
through `AUTH-024` from MASTER-SPEC §§574--580.

M02 is not complete until both email/password with mandatory email
verification and Google OAuth/OIDC work end-to-end, safe same-account
resolution/linking is implemented, password reset exists, local
development supports both paths, and authentication E2E tests pass.

Google authentication is identity-only; Google Drive or other Google
integrations must use separate future consent/scopes.

## M19 --- Unified Backend Architecture & Conformance Harness

### Goal

Establish one shared Kivro Cloud backend with two thin provider
composition roots before production deployment work.

### Requirements

`ARCH-UNI-001` through `ARCH-UNI-024`, plus `PORT-019` through
`PORT-030`.

### Required implementation

-   establish monorepo dependency boundaries;
-   extract/implement all provider-neutral backend behavior in shared
    TypeScript/Node packages;
-   define infrastructure ports owned by shared/core packages;
-   create `cloud-netsons` and `cloud-aws` composition roots that
    consume the same application services;
-   implement one public API contract source;
-   implement one logical PostgreSQL schema/migration history;
-   implement shared Worker Protocol plus polling and WebSocket
    transport adapters;
-   implement provider-independent backend conformance test harness;
-   implement architecture/dependency lint rules;
-   implement CI matrix and required merge gates.

### Acceptance

A representative shared feature and a representative bug fix must be
implemented once and proven through both composition roots. A
deliberately introduced provider-specific behavior divergence must fail
CI.

## M20 --- Netsons Deployment Profile

### Goal

Make the shared Kivro release deployable and production-correct on
Netsons without forking application behavior.

### Requirements

`HOST-NET-001` through `HOST-NET-031`, relevant `ARCH-UNI-*`, `PORT-*`,
and all shared product/security requirements exercised by the
deployment.

### Required adapters/profile

-   managed Node composition root;
-   PostgreSQL durable state;
-   Redis non-durable roles only where supported;
-   DB-backed durable work + bounded cron/request-driven processing;
-   HTTPS polling Worker transport adapter;
-   S3-compatible object storage adapter;
-   Netsons secrets/email/health/config/deploy packaging;
-   restart/reconciliation behavior.

### Acceptance

Run Netsons real-host smoke tests and full staging E2E against the same
shared release used by the AWS profile. All shared conformance tests
must pass through the Netsons composition root.

## M21 --- AWS Deployment Profile

### Goal

Make the exact same shared Kivro release deployable and
production-correct on AWS using AWS-native infrastructure adapters.

### Required adapters/profile

-   AWS managed compute/network deployment for the Node composition
    root;
-   PostgreSQL RDS/Aurora-compatible adapter/configuration;
-   AWS-native durable async/queue/event implementation behind shared
    ports;
-   secure WebSocket Worker transport adapter;
-   S3 storage adapter;
-   AWS secrets/configuration/observability/health/deployment pipeline;
-   reconnect/reconciliation and restart/failure behavior.

### Acceptance

Run AWS real-infrastructure smoke tests and full staging E2E. The same
shared conformance suite and public API contract suite must pass through
the AWS composition root.

AWS-specific implementation must not duplicate Kivro domain/application
business rules.

## M22 --- Dual-Control-Plane Continuity & Switch Readiness

### Goal

Prove that the two conformant deployments can coexist and that ACTIVE
control-plane selection can change without seller intervention or
codebase migration.

### Requirements

`PORT-001` through `PORT-030` plus `ARCH-UNI-017` through
`ARCH-UNI-024`.

### Acceptance scenario

``` text
one Worker identity paired once
→ Netsons control plane uses polling
→ Netsons owns execution A1
→ AWS control plane comes online using WSS
→ AWS passes exact shared-release conformance/staging gates
→ AWS becomes ACTIVE; Netsons becomes DRAINING
→ A1 continues only through Netsons/polling
→ new execution B1 is offered/claimed only through AWS/WSS
→ both complete exactly once
→ financial effects settle exactly once
→ Netsons drains to zero
→ Worker stops obsolete Netsons polling
→ Worker continues on AWS/WSS
→ no reinstall, re-pair or seller configuration change
```

Also test rollback before retirement, stale discovery, Worker restart,
endpoint rotation, delayed/duplicate messages, one-transport outage,
schema compatibility window, payment reconciliation and asset delivery.

## M23 --- Final Unified Compliance Audit

### Goal

Perform a final independent audit against the complete Master Spec, not
merely the implementation checklist.

### Mandatory audit

-   every requirement has implementation and test evidence;
-   all P0/P1/P2 requirements are complete;
-   all original product/security/payment/sandbox/research requirements
    remain satisfied;
-   no shared business behavior is duplicated across provider adapters;
-   Netsons and AWS expose the same public API contract;
-   both use the same logical schema/migration history;
-   both pass the same backend conformance suite;
-   provider-specific tests pass;
-   architecture dependency checks pass;
-   full local E2E passes;
-   full Netsons staging E2E passes;
-   full AWS staging E2E passes;
-   dual-control-plane transition E2E passes;
-   no unresolved security/payment correctness issue remains.

The auditor must inspect code/tests directly and must not trust
`COVERAGE.md` claims without evidence.

## M24 --- Architecture Fitness & Golden Conformance Hardening

**Preconditions:** unified shared-core/two-profile architecture and base
conformance harness exist.

**Deliverables:** dependency fitness tests; duplicate-semantic ownership
guard; golden scenario registry; drift canary; generated provider parity
evidence.

**Forbidden shortcuts:** manual-only parity checks; provider-specific
golden expectations for shared semantics; disabling architecture checks.

**Required tests:** both-provider golden suite and intentional
divergence rejection.

**Exit criteria:** shared/provider boundaries are machine-enforced and a
deliberately divergent adapter cannot pass CI.

## M25 --- Compatibility, Schema Evolution & Worker Update Hardening

**Preconditions:** Worker Protocol/versioning and DB migration tooling
exist.

**Deliverables:** explicit compatibility matrix; release compatibility
metadata; expand/deploy/contract migration workflow; signed Worker
release/update verification; minimum/revoked Worker policy; staged
update/recovery flow.

**Forbidden shortcuts:** destructive one-step schema rollout across
overlapping releases; backend switch requiring re-pair/update; unsigned
Worker artifacts.

**Required tests:** old/new compatible cloud/schema overlap,
incompatible fail-closed cases, Worker update signature rejection,
restart during dual-control-plane coexistence.

**Exit criteria:** declared compatibility windows are executable and
provider transition remains independent of Worker binary update.

## M26 --- Fault Injection, Recovery & Disaster Readiness

**Preconditions:** durable job/payment/asset flows and both provider
profiles exist.

**Deliverables:** fault-injection harness; restore runbook; automated
backups; isolated restore test; Redis-loss recovery test; reconciliation
dashboards/alerts; declared production RPO/RTO before go-live.

**Forbidden shortcuts:** backup-config-only DR claims; tests that assert
only transport/request failure without final state; using Redis as
unrecoverable authoritative state.

**Required tests:** ambiguous commit/ack failures, duplicate
webhooks/completions/tasks, process restarts, cache loss,
one-control-plane outage and restore invariant checks.

**Exit criteria:** failures converge to correct authoritative state with
no duplicate execution/settlement and restore evidence exists.

## M27 --- Performance Envelope & Unified Release Operations

**Preconditions:** staging-capable Netsons and AWS profiles.

**Deliverables:** documented MVP resource/performance envelopes;
load/resilience tests; unified release manifest; exact-release
activation gates; generated parity report; operational alarms for
backlog/reconciliation/Worker-version health.

**Forbidden shortcuts:** independently versioning Netsons/AWS as
different products; activating an untested exact release; unbounded
queues/uploads/retries.

**Required tests:** profile load tests within selected envelope, release
manifest validation, activation gate rejection on missing
parity/conformance evidence.

**Exit criteria:** release is identifiable, reproducible, bounded and
activation-safe on either provider.

## M28 --- Final Lossless Compliance & Security Audit

This supersedes any earlier final-audit milestone as the terminal gate.
Audit the complete Master Spec and all `ARCH-UNI-*`, `PORT-*`,
`HOST-NET-*`, `HARD-*` requirements directly against
code/tests/evidence. Verify every P0/P1/P2 requirement, both deployment
profiles, golden scenarios, architecture fitness, compatibility windows,
fault injection, restore evidence, threat-control-test evidence, release
manifest/parity report and dual-control-plane transition. Do not trust
coverage claims without direct evidence.

## M29 --- Durable Asynchronous Buyer Delivery

### Goal

Implement purchase→wait→execute→persist→notify→later-retrieve once in
the shared Core and prove identical Netsons/AWS behavior.

### Requirements

`ASYNC-001` through `ASYNC-030` plus existing
scheduling/payment/asset/security/portability requirements.

### Implementation

Durable job/input persistence; private input storage; restart-safe
scheduled/queued reconstruction; cloud output-finalization barrier;
persistent text/structured/file outputs; My Jobs/Purchases + result
page; authorized regenerable downloads; retention/expiry + safe cleanup;
durable email/webhook notification work; duplicate/restart/object
inconsistency reconciliation; REST result semantics; provider adapters
only for mechanics; `ASYNC-GOLD-001..010`.

### Forbidden shortcuts

Browser connection as job owner; local filesystem as durable result
storage; `COMPLETED` before cloud finalization; public/permanent output
URLs; object-key-only authorization; provider-specific result semantics;
settlement solely from unvalidated Worker success; notification success
as completion prerequisite.

### Exit criteria

Buyer can leave after committed purchase and retrieve later; overnight
schedule passes; seller Worker can disappear after finalization; both
profiles pass all ASYNC golden scenarios; exactly-once financial effects
survive duplicate/lost acknowledgement;
authorization/retention/restart/reconciliation tests pass; UI/API expose
equivalent durable semantics; all `ASYNC-*` have evidence.

## M30 --- Buyer Predictability, Control & Trust

### Goal

Make buying long-running/scheduled seller capabilities understandable
and controllable before and during execution.

### Scope

`BUYERUX-001..014`, `BUYERUX-025..031`, `BUYERUX-035..045`.

### Build

Shared preflight/quote service; deadline/max-wait model;
cancel-before-start and cancel/claim atomicity; progress event contract;
ETA estimator with explicit unknown/confidence behavior; notification
preferences; missed-window/delayed state; bounded job expiry; seller
reliability aggregation; privacy disclosure derived from manifests;
pseudonymous/minimized Worker payload; graceful seller disappearance;
buyer operational dashboard.

### UX acceptance

Before purchase buyer understands price, current availability, likely
timing/unknowns, deadline compatibility and what data reaches seller.
After purchase buyer always has an understandable state, legal actions
and bounded wait. No fake progress/ETA or indefinite limbo.

### Forbidden shortcuts

Seller-authored reliability; UI-only cancellation; hard-coded provider
timing semantics; sending full buyer profile to Worker; treating
estimates as guaranteed SLA; indefinite scheduled state; invented
progress percentages.

### Exit

`BUYERUX-GOLD-001..006`, `011..013`, `016..018` pass on both profiles
and have UX screenshots/E2E evidence.

## M31 --- Buyer History, Reuse & Rich Results

### Goal

Turn completed Kivro work into a clear, trustworthy, reusable buyer
workspace.

### Scope

`BUYERUX-015..024`, `BUYERUX-032..034` plus `ASYNC-*`.

### Build

Run again; Duplicate & edit; semantic result manifest; secure previews;
bounded Download all; immutable input snapshot; immutable
capability/purchase snapshot; retention UX/reminders;
acknowledgement/problem reporting.

### UX acceptance

A buyer returning days later can understand what was submitted, what was
bought, what was produced, preview/download it safely, know when it
expires, report a problem, and create a new independently authorized run
without modifying history.

### Forbidden shortcuts

Mutating old job; silently reusing expired assets; public preview URLs;
arbitrary active content in Kivro origin; ZIP path traversal; assuming
historical price/version; problem report silently altering settlement.

### Exit

`BUYERUX-GOLD-007..010`, `014..015` pass on both profiles with
accessibility/responsive/visual evidence.

## M32 --- Seller Onboarding, Discovery & Safe Publication

### Goal

Make the first capability safe to configure and publish without
requiring the seller to understand Kivro internals.

### Scope

`SELLERUX-001..012`, `SELLERUX-022..023`, `SELLERUX-031..035`,
`SELLERUX-039`.

### Build

Guided Worker onboarding; read-only discovery; progressive capability
wizard; AI-assisted drafts with hard authorization boundaries;
dependency graph; visual permissions; buyer preview; deterministic
publish readiness; local credential setup and freshness-aware health;
availability scheduling; Doctor/UI diagnostics; accurate seller security
disclosure; public-vs-KYC identity separation; first-publication
guidance; LIVE-vs-draft version diff.

### Exit

Seller can reach safe first publication through UI/Worker guidance; no
raw manifest required; nothing discovered is exposed without consent;
secrets stay local; buyer preview matches contract; all relevant
SELLERUX golden scenarios pass both profiles.

## M33 --- Seller Operations, Economics & Reliability

### Goal

Give sellers control over work, profitability, health and earnings after
publication.

### Scope

`SELLERUX-013..021`, `SELLERUX-024..030`, `SELLERUX-038`,
`SELLERUX-040..041`.

### Build

Temporary pause; concurrency capacity; seller operations/job dashboards;
provider-cost estimation and guardrails; profit/earnings/capability
analytics; rollback; deterministic auto-pause; notification preferences;
maintenance; explainable unavailability; reputation explainability;
first-sale explanation.

### Exit

Seller can understand whether work is available, why not, what is
running, expected economics, actual ledger earnings, health failures and
safe recovery; Worker cannot forge money; provider cost guardrails work;
parity tests pass.

## M34 --- Multi-Worker Domain Readiness

### Goal

Ensure greenfield architecture does not bake in a one-seller/one-machine
assumption.

### Scope

`SELLERUX-036..037`.

### Build

Explicit Worker entity/identity ownership, seller→Workers relationship,
capability/version eligible Worker assignment/routing contract,
independent health/session state and tests with at least two Worker
identities. MVP product exposure may remain intentionally limited.

### Exit

Two-Worker conformance test passes without schema hacks or
provider-specific routing semantics.
