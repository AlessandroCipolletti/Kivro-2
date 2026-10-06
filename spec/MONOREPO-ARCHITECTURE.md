# Kivro Unified Monorepo Architecture

This document is an implementation companion to `MASTER-SPEC.md`. The
Master Spec remains authoritative.

## Principle

Kivro has one backend product implementation and two deployment
profiles.

``` text
                         shared Kivro application
                                  |
                  +---------------+---------------+
                  |                               |
             Netsons adapters                  AWS adapters
                  |                               |
             Netsons runtime                    AWS runtime
```

## Dependency direction

Shared/domain/application packages own interfaces. Provider packages
implement them. Provider packages never become semantic owners of
product behavior.

## Expected code ownership

Shared: domain models, use cases, API handlers/controllers where
portable, validation, auth semantics, payments/ledger, job state
machine, Worker Protocol, permissions, research policy, files logical
rules, persistence model, public contracts.

Netsons-only: hosting bootstrap/config, polling transport mechanics,
DB+cron durable work mechanics, Netsons operational packaging.

AWS-only: AWS IaC/config, WSS transport mechanics, AWS
queue/event/scheduler mechanics, S3/AWS operational integration.

## Change examples

**Add capability pause:** shared implementation once; adapters only if
new infrastructure primitive is actually needed.

**Fix seller payout rounding:** shared payment package once; both
conformance suites prove the fix.

**Tune Netsons polling backoff:** Netsons transport adapter only; shared
Worker Protocol semantics unchanged.

**Change AWS queue visibility timeout:** AWS adapter/IaC only; shared
job lease semantics unchanged.

## Forbidden patterns

-   duplicate `createJob`, `settlePayment`, `publishCapability`, etc.
    implementations per provider;
-   provider-specific API schemas;
-   provider-specific business state machines;
-   separate database schema histories;
-   shared packages importing AWS/Netsons SDK/package code;
-   marking a shared feature complete with only one profile passing.

## Durable result ownership

Durable semantics live in shared `jobs`, `assets`, `application`,
`api-contracts` and infrastructure-contract packages. Netsons/AWS
packages own mechanics only. Neither adapter defines `COMPLETED`,
retention semantics, download authorization or settlement conditions.

## Buyer Experience ownership

Preflight/quote, deadlines, cancellation, expiry, progress semantics,
ETA policy, reliability calculation, privacy projection, history
snapshots and result semantics live in shared domain/application
packages. Web renders these contracts. Provider adapters supply
mechanics/telemetry only and cannot redefine buyer policy.

## Seller Experience ownership

Shared packages own seller onboarding state, capability discovery
representation, permission/dependency contracts, readiness,
schedule/pause/capacity, cost policy, earnings projections,
versioning/rollback, health reasons, marketplace identity projection and
Worker assignment. Provider adapters supply mechanics only. Financial
truth remains ledger/payment domain; secret values remain outside cloud
domain where designed.
