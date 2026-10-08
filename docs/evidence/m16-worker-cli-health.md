# Installed Worker health and doctor — Master Spec §§379–380

The current-tree `pnpm test:e2e:local` passed 2/2 with the host-native
installed Worker connected, a reviewed capability loaded and Docker running.
The test invokes the actual `kivro-worker health --json` entrypoint from a
second process using the Worker-only environment. It requires `HEALTHY`,
accepting new work, known reviewed capability capacity, and positive device
identity, Docker daemon, approved image, cloud connection and execution
capacity checks. It separately invokes `doctor --json` and requires active
OpenClaw compatibility, identity, Docker, cloud and approved-image diagnostics
plus a passing restrictive sandbox self-test. The output is checked for cloud
credential names and sensitive seller path patterns.

`tests/worker-cli.test.mjs` additionally runs the text/JSON CLI in a fresh
private state directory: local emergency pause survives a second process,
health reports `PAUSED` and refuses new work, resume fails closed without
prerequisites, doctor reports missing image/capacity as failures, and an
environment secret sentinel and local path do not appear in output. Cloud and
seller dashboard regressions cover stale/reconnected heartbeat states.

This verifies the operational CLI behaviors in `WRK-0106` and `WRK-0108`.
The example's queued-job count is Cloud-owned and is not fabricated by the
local command; the seller dashboard shows authoritative queue counts.
