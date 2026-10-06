# Version & Compatibility Model

Authoritative details are in `MASTER-SPEC.md`. This file is the
operator/developer quick reference.

Track independently: Cloud release, Worker release, Worker Protocol,
public API, DB schema revision, capability manifest schema and adapter
revisions.

A release declares supported ranges. Backend transition does not require
Worker update if protocol and advertised transport are already
compatible. Database rollout follows expand → deploy/backfill →
contract. ACTIVE/DRAINING coexistence is allowed only inside the
declared compatibility window.

CI/release gates must reject unknown/incompatible combinations rather
than guessing.

## Durable result compatibility

Compatibility windows preserve in-flight scheduled/long jobs. A newer
ACTIVE cloud release cannot prevent an older compatible in-flight
execution from finalizing. Output manifest/version parsing follows
declared compatibility windows and fails safely when unsupported.

## Buyer Experience compatibility

Cloud/API/Worker compatibility windows preserve quote/job snapshots,
declared progress events, deadline/expiry fields and output manifests
for in-flight historical jobs. New releases must render supported older
job snapshots without rewriting them.

## Seller Experience compatibility

Worker/cloud compatibility preserves capability drafts/published
versions, dependency/permission manifests, health semantics,
schedule/pause/capacity, cost guardrails and explicit Worker assignment.
A backend/Worker upgrade cannot silently expand permissions or reassign
a capability to an unapproved Worker.
