# Kivro

Kivro is a greenfield marketplace for narrowly scoped, seller-hosted OpenClaw capabilities. The authoritative product and engineering specification is in [`spec/`](spec/MASTER-SPEC.md).

## Current state

The repository has implementation through M09's shared Core scheduling boundary. M10 buyer marketplace work has not started. The M07 sandboxed OpenClaw path, M08 ledger/credit model and M09 scheduling path have real component and PostgreSQL evidence; a public paid buyer flow still needs the later UI, API, deployment and E2E milestones. See [`docs/implementation-status.md`](docs/implementation-status.md) and [`docs/verification-backlog.md`](docs/verification-backlog.md) for evidence and open gates.

Run `pnpm install`, then `pnpm typecheck`, `pnpm lint` and `pnpm test`. `pnpm openclaw:inspect` uses a read-only filesystem scanner for bounded local config and file-backed skill metadata; its sanitized result remains advisory, with unknown readiness and no seller consent. Stateful personal config/skill CLI commands stay disabled. `pnpm worker health --json` reports the current local state, and `pnpm worker pause --all` durably pauses new work locally.

`pnpm test:postgres:m01` runs the first migration and constraint checks in a disposable, port-free PostgreSQL 16 Docker container. It requires a local Docker daemon and image.

`pnpm test:openclaw:isolation` validates the generated dedicated Worker config against a locally installed OpenClaw CLI. It runs OpenClaw with isolated temporary home/state/config paths and does not read the seller's personal OpenClaw profile.

For the M02 authentication path, run `pnpm local:auth:up`, then `pnpm local:auth:migrate`, then `pnpm test:auth:local` and `pnpm test:auth:browser`. Setup writes private `.env.local` once and starts loopback-only PostgreSQL and Mailpit. [`.env.example`](.env.example) explains each setting and contains deliberately unusable secret placeholders; use the generated `.env.local` for local development. The backend and Chrome browser tests exercise real email registration, verification, login, reset, logout and SMTP delivery; they do not require Google credentials. The browser test uses local port 3335 and the installed Chrome on macOS. Mailpit is available at `http://127.0.0.1:18025`. `pnpm local:auth:mail --once` drains queued auth messages. The Worker and web app remain host-native; this Compose file supplies auth infrastructure only.

For M03 seller entry, `pnpm test:seller:local` checks one seller profile per verified account, concurrency and the append-only execution-model acknowledgement against the local PostgreSQL database. `pnpm test:postgres:m03` checks visibility, private grants, lifecycle and acknowledgement constraints in a disposable database. The browser auth test also creates a draft seller profile after explicit acknowledgement.

`pnpm test:sandbox:docker` runs the M04 real Docker isolation canary using a cached, digest-pinned Alpine fixture. It checks effective container settings, host-path/socket/network/root/input denial, non-root privileges, timeout, cleanup and fail-closed missing prerequisites. The pinned OpenClaw image has its separate M07 execution suite. See [`docs/test-evidence/m04-sandbox.md`](docs/test-evidence/m04-sandbox.md).

For M05, `pnpm local:auth:up` starts PostgreSQL, mail and a private S3-compatible SeaweedFS service on loopback, creates the bucket and checks anonymous access is denied. `pnpm test:postgres:m05` runs asset/grant constraints; `pnpm test:storage:seaweedfs` checks the pinned, pullable local storage image; `pnpm test:storage:minio` remains an optional second adapter check using a cached MinIO image. `pnpm test:sandbox:output` tests size-limited stopped-output transfer, and `pnpm test:output:storage` runs the real bidirectional Docker ↔ private storage path.

For M06, `pnpm test:postgres:m06` runs broker usage, read-only resource and provider-budget checks in a disposable PostgreSQL container. `pnpm test:research:live` makes one bounded pinned HTTPS GET to `example.com`; it needs outbound DNS/HTTPS. The Brave search adapter is tested with fixtures; a real platform token is not configured by local setup. [`.env.example`](.env.example) describes `KIVRO_BRAVE_SEARCH_TOKEN` for the later cloud composition root. See [`docs/milestones/M06.md`](docs/milestones/M06.md) for evidence and deferred gates.

For M07–M09, run `pnpm test:postgres:m07`, `pnpm test:postgres:m08`, `pnpm test:postgres:m09` and `pnpm test:openclaw:execution`. These exercise durable execution, exact credit/ledger transitions, availability/queue races and the pinned Docker/OpenClaw image. `pnpm scheduler` runs host-native M09 reconciliation against `DATABASE_URL`; set `KIVRO_STRIPE_MODE` to the database's Stripe mode and optionally tune `KIVRO_SCHEDULER_INTERVAL_MS`. In local development run the scheduler in its own terminal alongside the web app and Worker. `node tools/kivro-scheduler.mjs --once` performs one bounded sweep after `pnpm build`. Deployment scheduling in Netsons and AWS remains an M19 task.

Run `pnpm --filter @kivro/web dev` for the local web UI after setup. The setup command links the web app to the ignored local environment file. Start `pnpm local:auth:mail --watch` in another terminal to deliver verification and reset messages while using the UI.

For local Google OIDC setup, create a non-production Google OAuth web client and register `http://localhost:3000/api/auth/callback/google` as its authorized redirect URI. Put its client ID and secret in the ignored `.env.local`. The login flow requests only `openid`, `email`, and `profile`; no Drive or other Google scopes. Real Google callback acceptance is still open until non-production credentials are supplied and browser tests pass.

## Architecture boundary

Shared TypeScript packages own domain behavior, contracts, job and payment rules, security policy, and Worker Protocol semantics. Netsons and AWS contain only deployment composition and infrastructure adapters. The seller Worker is a separate host-native process and never executes paid work outside the required sandbox.

Paid Core execution remains fail-closed unless the exact M08 reservation, M09 eligibility, M07 lease, Worker readiness and approved sandbox all pass. The public buyer-to-Worker paid flow is still an open later-milestone gate.
