# Durable Asynchronous Jobs & Results

## Core invariant

A paid Kivro job is a durable asynchronous resource. The buyer can leave
after committed purchase. `COMPLETED` means Kivro---not merely the
seller machine---has durably finalized declared buyer deliverables.

## Storage and retrieval

PostgreSQL stores authoritative job/output identity, state and metadata.
Private object storage stores binary inputs/outputs. Worker/sandbox
files are temporary. Buyer returns through My Jobs/Purchases and obtains
persisted text plus re-authorized short-lived downloads. Seller Worker
availability is irrelevant after finalization.

## Scheduling, retention and notifications

Scheduled/offline jobs retain cloud state/assets until execution.
Retention is explicit/configurable/shared across providers; cleanup is
idempotent. Email/webhooks notify terminal outcomes but durable history
is authoritative.

## Required proof

`ASYNC-GOLD-001..010` pass against both provider composition roots.
