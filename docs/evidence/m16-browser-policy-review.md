# M16 original Master Spec §17 browser-policy review

The MVP does not offer arbitrary browser jobs. The Worker broker accepts only
named Kivro tools; it rejects a manifest that allows `browser`, and now also
rejects a seller package whose permission policy declares browser use without
an allowed tool. This closes a misleading declaration path found during the
M16 audit. A representative seller package with browser permission fails
review before publication. The real pinned Docker/OpenClaw hostile-file test
has the model request `browser` after reading buyer-controlled bytes and proves
the request is denied. The paid sandbox has no seller browser profile/cookies,
no host browser mount and no direct network access.

Evidence: `apps/worker/src/broker-router.ts`,
`packages/openclaw-adapter/src/job-config.ts`,
`tests/worker-broker-router.test.mjs`,
`tests/docker-worker-supervisor-local-integration.mjs`,
`tests/m16-installed-worker-e2e.mjs` and
`docs/evidence/m16-boundaries.json`.

`SEC-0022` and `SEC-0023` are MVP controls. `SEC-0024` and `SEC-0025` are
explicitly conditional in the original §17: if a browser capability is added
after MVP, it must use a marketplace-controlled isolated browser service and
prove the specified cookie, network, session, domain, rate, action, audit and
kill-switch controls before activation. They remain `DEFERRED`, not verified
by the current prohibition.
