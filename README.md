# Kivro

Kivro is a greenfield marketplace for narrowly scoped, seller-hosted OpenClaw capabilities. The authoritative product and engineering specification is in [`spec/`](spec/MASTER-SPEC.md).

## Current state

The repository has M00 bootstrap, M01 shared domain/contract foundations, and an active **M02 Worker and OpenClaw integration** increment. There is no runnable buyer, seller, or paid job flow yet. See [`docs/implementation-status.md`](docs/implementation-status.md) and [`docs/verification-backlog.md`](docs/verification-backlog.md) for evidence and open gates.

Run `pnpm install`, then `pnpm typecheck`, `pnpm lint` and `pnpm test` for the current foundation. `pnpm openclaw:inspect` probes only the installed OpenClaw version; personal config and skill commands are disabled after one attempted state change during inspection. `pnpm worker health --json` reports the current local state, and `pnpm worker pause --all` durably pauses new work locally. These commands do not enable paid jobs.

`pnpm test:postgres:m01` runs the first migration and constraint checks in a disposable, port-free PostgreSQL 16 Docker container. It requires a local Docker daemon and image.

`pnpm test:openclaw:isolation` validates the generated dedicated Worker config against a locally installed OpenClaw CLI. It runs OpenClaw with isolated temporary home/state/config paths and does not read the seller's personal OpenClaw profile.

## Architecture boundary

Shared TypeScript packages own domain behavior, contracts, job and payment rules, security policy, and Worker Protocol semantics. Netsons and AWS contain only deployment composition and infrastructure adapters. The seller Worker is a separate host-native process and never executes paid work outside the required sandbox.

No paid execution is enabled by the current foundation.
