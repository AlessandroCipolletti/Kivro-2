# M07 isolated OpenClaw runtime

The image pins Node 24 by registry digest and OpenClaw 2026.8.2 through an
integrity-pinned npm lockfile. Its only entry point accepts `--version` or
`run-job`. A job reads a Worker-built config and message from the private,
read-only `/job/input` mount, waits for the Worker-controlled loopback bridge,
and runs OpenClaw as uid 65532 inside a network-denied, read-only Docker
container. No seller personal OpenClaw state or provider credential is mounted.
The generated OpenClaw config sets `sandbox.mode=all` and selects the pinned
`kivro-contained` backend. That backend accepts only the already-created,
Worker-inspected per-job container and denies shell execution. It never gets
the seller's Docker socket. Before `agent exec`, the runner checks OpenClaw's
effective `sandbox explain --json` report for mode, backend, workspace mounts,
tool allowlist and disabled elevation; any mismatch stops the job.

`plugin/` contains only fixed Kivro broker and file/result tools. The Worker
routes seller-selected research, local resources, declared APIs and inference
through its policy ports. Discovery never installs or enables a tool. The
Worker validates output after the container stops and uploads only declared
result files to private durable storage.

Run `pnpm test:openclaw:execution` to build and exercise the exact image with
real OpenClaw agent execution, broker denial, file output and Worker supervisor
tests. Then run `pnpm openclaw:approve-local-image` to repeat the suite and
write a private `0600` approval record at
`.local/worker/openclaw-image-approval.json`. Execution requires that exact
digest, matching runtime-source hash and version label. Editing the runtime or
building a new digest invalidates the record. The mutable `:m07` tag is used
only to build/test the candidate; it is never an executable job plan.

This approves the local runtime image only. Paid execution still requires the
authoritative M08 reservation verifier and authenticated M13 cloud routes.
The test suite's synthetic model and payment fixtures are test-only.
