# Effective OpenClaw tool policy (§15)

Marketplace tool selection is deny by default. The reviewed Worker manifest
contains an exact allowlist, and the isolated OpenClaw config refuses native
`exec`, `process`, `read`, `write`, `browser`, `gateway`, `cron` and similar
built-ins. The Worker broker accepts only specifically declared narrow
`kivro_*` tools. Seller publication rejects shell/browser permission claims
that the runtime cannot honor. No currently publishable capability requires
a command-line program; such a capability fails review rather than receiving
generic `exec` access. If a future supported capability needs a program, it
must add a separately reviewed narrow broker wrapper before publication.

`tests/docker-worker-supervisor-local-integration.mjs` runs real pinned
OpenClaw in Docker with a selected skill containing an instruction to ignore
policy and a hostile buyer file. After reading that file the model requests
forbidden `exec`, `browser` and `read`; the broker denies all three. The same
test rejects a browser-dependent seller package before publication.
`tests/openclaw-job-config.test.mjs`, `tests/worker-broker-router.test.mjs`
and `tests/docker-broker-sidecar-local-integration.mjs` verify exact config,
manifest and sidecar routing. The paid installed Worker fixture also exercises
the approved tool path and host/network denial. These tests passed in the
2026-10-07 M16 boundary matrix.

This closes the original MVP §15 tool-policy requirements. It does not claim
that a future arbitrary shell capability or unreviewed native plugin is
supported.
