# Backend Conformance & CI Matrix

## Purpose

Prevent Netsons and AWS from drifting while allowing their
infrastructure mechanics to differ.

## Required suites

1.  Shared unit tests.
2.  Shared application integration tests.
3.  Public API contract tests.
4.  Database/schema compatibility tests.
5.  Worker Protocol semantic tests.
6.  Payment/ledger/idempotency tests.
7.  Security invariant tests.
8.  Netsons composition conformance.
9.  AWS composition conformance.
10. Netsons profile-specific tests.
11. AWS profile-specific tests.
12. Dual-control-plane transition E2E.

## Merge gate

Any backend-affecting pull request must pass both composition-root
conformance suites. The inactive production provider is still a required
supported target.

## Release gate

A provider cannot become ACTIVE until the exact release candidate passes
its real-infrastructure smoke tests and full staging E2E.

## Drift canary

Maintain at least one CI test that intentionally substitutes a
non-conformant adapter/test double and proves the suite detects semantic
divergence. This guards against a conformance suite that only tests
happy-path wiring.

## Golden scenario registry

Golden scenarios are provider-neutral fixtures with canonical inputs,
expected observable state transitions and financial/security assertions.
The registry is versioned and executed unchanged against both provider
composition roots.

## Fault matrix

For every distributed transition with an external side effect, test
failure before operation, after side effect/before acknowledgement,
after acknowledgement, duplicate delivery and process
restart/reconciliation where meaningful.

## Architecture fitness gate

The conformance pipeline begins with dependency/ownership tests. A
behaviorally correct provider implementation still fails if it violates
shared-core dependency direction or duplicates semantic ownership.

## Drift canary

CI includes an intentionally broken adapter/test fixture so the
conformance suite continuously proves it can detect provider divergence
rather than merely exercising wiring.

## Release matrix

Conformance output records application commit/version, API contract
version, Worker Protocol compatibility, schema compatibility and adapter
revisions. Results feed the generated provider parity report and release
manifest.

## Golden scenario family --- durable asynchronous buyer delivery

The same scenarios MUST execute against Netsons and AWS composition
roots.

-   **ASYNC-GOLD-001 buyer disconnects:** committed text+file job
    survives buyer disappearance and is retrievable from a fresh session
    after later execution.
-   **ASYNC-GOLD-002 overnight seller:** purchase while scheduled
    offline → durable wait → later Worker execution → seller offline →
    next-day buyer retrieval.
-   **ASYNC-GOLD-003 cloud restart while waiting:** queued/scheduled job
    survives process restart without duplicate execution/payment.
-   **ASYNC-GOLD-004 Worker disappears after finalization:**
    acknowledged output remains fully retrievable.
-   **ASYNC-GOLD-005 lost completion acknowledgement:** retry yields one
    terminal job, one logical output set, one charge and one seller
    earning.
-   **ASYNC-GOLD-006 authorization isolation:** unrelated
    buyer/seller/anonymous/expired URL cannot retrieve output; owner can
    regenerate access.
-   **ASYNC-GOLD-007 retention cleanup:** expiry and partial DB/storage
    cleanup failures converge without harming non-expired
    assets/history.
-   **ASYNC-GOLD-008 notification failure:** completed result remains
    authoritative/retrievable while notification retries independently.
-   **ASYNC-GOLD-009 missing/corrupt object:** reconciliation detects
    inconsistency; broken output is not silently presented as healthy.
-   **ASYNC-GOLD-010 mixed control planes:** Netsons/polling old job and
    AWS/WSS new job each finalize exactly once with identical
    buyer-result semantics.

## Golden scenario family --- Buyer Experience

Run unchanged against Netsons and AWS composition roots.

-   **BUYERUX-GOLD-001 quote/preflight:** known unavailable dependency
    blocks purchase; healthy capability returns price/start/completion
    range or explicit unknown plus quote expiry; stale quote is
    rejected/requoted.
-   **BUYERUX-GOLD-002 hard deadline:** infeasible deadline is
    rejected/warned per policy; feasible deadline persists and
    Marketplace Agent cannot bypass it.
-   **BUYERUX-GOLD-003 cancel before start:** scheduled buyer
    cancellation wins atomically, prevents dispatch and releases/refunds
    once.
-   **BUYERUX-GOLD-004 cancel/claim race:** concurrent Worker claim and
    buyer cancel produces exactly one legal outcome and correct money
    state.
-   **BUYERUX-GOLD-005 progress persistence:** buyer
    disconnects/reconnects and sees latest safe structured progress;
    malicious progress content cannot leak secrets/unsafe markup.
-   **BUYERUX-GOLD-006 ETA honesty:** insufficient history yields
    unknown; sufficient history yields bounded range; no fake
    percentage/precision.
-   **BUYERUX-GOLD-007 rerun/duplicate:** historical job remains
    immutable; new job gets current version/price/permissions and
    expired input file requires replacement.
-   **BUYERUX-GOLD-008 rich result:** semantic manifest renders named
    outputs; safe preview remains private; unsafe format downloads only.
-   **BUYERUX-GOLD-009 download all:** authorized bundle contains only
    buyer deliverables and resists traversal/malicious names; bundle
    failure leaves individual files available.
-   **BUYERUX-GOLD-010 snapshots:** later seller edits do not change
    historical input/purchase/capability snapshot.
-   **BUYERUX-GOLD-011 missed window:** seller never appears; buyer sees
    delayed/missed state and allowed wait/cancel choices instead of
    indefinite scheduled state.
-   **BUYERUX-GOLD-012 expiry:** latest-start expires while Worker races
    to claim; no execution after expiry and one correct release/refund.
-   **BUYERUX-GOLD-013 reliability:** metrics use authoritative eligible
    history, insufficient sample is explicit and no private buyer data
    leaks.
-   **BUYERUX-GOLD-014 retention UX:** result shows expiry, reminder may
    fire, expired binary loses download action while historical job
    remains.
-   **BUYERUX-GOLD-015 problem report:** durable report links immutable
    execution evidence and does not silently reverse settlement.
-   **BUYERUX-GOLD-016 privacy disclosure:** UI disclosure matches
    actual Worker payload; email/payment/unrelated profile absent.
-   **BUYERUX-GOLD-017 seller disappearance:** stale Worker before start
    follows bounded wait/refund; disappearance after finalized
    completion does not affect result.
-   **BUYERUX-GOLD-018 dashboard:** mixed
    scheduled/running/completed/failed/expiring jobs render from
    authoritative state consistently across profiles.

## Golden scenario family --- Seller Experience

Run equivalent scenarios against Netsons and AWS composition roots.

-   **SELLERUX-GOLD-001 onboarding:** fresh seller pairs once;
    incompatible OpenClaw/sandbox produces actionable blocker; fixing it
    reaches ready without weakening policy.
-   **SELLERUX-GOLD-002 discovery consent:** Worker discovers multiple
    local candidates; none are exposed until individually selected;
    rejected candidate never enters effective manifest.
-   **SELLERUX-GOLD-003 AI-assisted draft:** AI proposes
    listing/I-O/dependencies but cannot publish or expand permissions;
    seller approval plus deterministic validation required.
-   **SELLERUX-GOLD-004 dependency/permission review:** unresolved
    mandatory dependency blocks publish; effective visual permission
    summary matches machine manifest.
-   **SELLERUX-GOLD-005 buyer preview/readiness:** seller previews exact
    draft buyer contract; mandatory readiness blocker prevents publish
    while recommended item does not.
-   **SELLERUX-GOLD-006 secrets/health:** credential configured locally;
    cloud sees reference/health only; logs/diagnostics contain no
    secret; stale health becomes unknown/stale.
-   **SELLERUX-GOLD-007 schedule/pause/capacity:** custom timezone
    schedule, temporary pause and concurrent-slot limit produce correct
    buyer availability and no over-dispatch.
-   **SELLERUX-GOLD-008 seller job privacy:** job detail/Worker payload
    contains declared inputs but not buyer email/payment/unrelated
    profile.
-   **SELLERUX-GOLD-009 cost protection:** estimated provider cost/net
    shown; per-job guardrail stops excessive provider use without buyer
    override and settles according to failure policy.
-   **SELLERUX-GOLD-010 earnings/profit:** ledger/Stripe drives
    pending/available/paid; Worker cannot forge earnings; estimated
    provider cost is labeled separately.
-   **SELLERUX-GOLD-011 analytics privacy:** capability
    funnel/runtime/reliability metrics recompute from authoritative
    events without exposing buyer-private records.
-   **SELLERUX-GOLD-012 version diff:** draft permission expansion is
    prominent; publish creates new immutable version and old jobs remain
    pinned.
-   **SELLERUX-GOLD-013 rollback:** bad new version stops new jobs;
    eligible previous version restored; in-flight new-version job
    remains pinned; insecure obsolete rollback is blocked.
-   **SELLERUX-GOLD-014 auto-pause:** repeated deterministic
    failure/credential break pauses new purchases and shows exact
    remediation; retest restores only after health passes.
-   **SELLERUX-GOLD-015 notifications/maintenance:** seller enters
    maintenance and receives deduplicated relevant alerts; marketplace
    shows maintenance/known return rather than unexplained offline.
-   **SELLERUX-GOLD-016 explainable availability/doctor:** each blocking
    readiness factor is surfaced and Doctor output is useful but
    secret/private-data sanitized.
-   **SELLERUX-GOLD-017 security/privacy promise:** buyer cannot access
    personal OpenClaw/credentials/unselected files; seller disclosure
    accurately shows resources selected by capability.
-   **SELLERUX-GOLD-018 marketplace identity:** public brand differs
    from private KYC identity; KYC data does not leak through
    listing/job/API.
-   **SELLERUX-GOLD-019 multi-Worker model:** seller owns two Worker
    identities with independent health/assignment; routing selects
    eligible assigned Worker without singleton assumptions.
-   **SELLERUX-GOLD-020 reputation explainability:** seller sees
    disclosed metric contributors/sufficient-sample status consistent
    with buyer reliability semantics.
-   **SELLERUX-GOLD-021 first sale:** new seller publishes, completes
    payout/readiness journey, receives first job, then sees
    earning/fee/cost/settlement explanation.
