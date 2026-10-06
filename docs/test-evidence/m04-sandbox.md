# M04 offline Docker sandbox evidence — 2026-10-06

Host: local macOS development machine; Docker Desktop engine 29.7.2. Fixture image: locally cached `alpine@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b`. It is a security canary image, **not** an approved OpenClaw execution image.

Executed `pnpm test:sandbox:docker` against the real Docker daemon. The adapter validated the strict offline plan, checked the pinned image, created an ephemeral container, inspected its effective Docker settings before start, ran the canary, and removed it. Assertions passed for UID/GID 65532, zero effective capabilities, no-new-privileges, read-only root/input, no Docker socket or personal OpenClaw path, no unmounted host sentinel, blocked outbound IP access, writable temporary output, runtime timeout and cleanup. Missing Docker, missing approved image, altered image and symlinked attempt directory all refused without host execution. No new `kivro-sbx-` container remained after the run.

`pnpm typecheck`, `pnpm lint`, `pnpm test` (96 tests), CI YAML parse and `tests/coverage-backlog.test.mjs` passed after the M04 changes. The GitHub Actions workflow is defined but has not run on a hosted runner in this local session.

Limits: the canary does not execute OpenClaw or a buyer job; no brokered egress, seller secret, paid admission, object-storage finalization or production host has been tested. The private 0700 host input staging is mounted read-only, but its content-readability as non-root and safe output collection are M05 work. Do not promote a Worker or paid capability from this evidence alone.
