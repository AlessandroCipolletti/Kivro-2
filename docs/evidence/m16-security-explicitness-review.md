# M16 §94 security-sensitive code review

`TST-0015` says security-sensitive code should favor explicitness over
abstraction. This is a source-review criterion, so the evidence is an
adversarial reading of current production paths plus their executed boundary
tests; it is not inferred from a passing lint command alone.

Reviewed paths:

- `packages/persistence/src/finance.ts`: paid admission checks a specific
  reservation, job/buyer/version/price snapshot, reserve journal movements,
  buyer billing mode and reconciled seller Connect readiness. Reservation,
  release, settlement and payout have named methods, row locks, effect keys
  and structured `FinanceError` codes. No Worker message is accepted as a
  financial authority.
- `apps/worker/src/job-admission.ts`: local admission names and independently
  checks the authenticated control plane, Worker identity, lease expiry,
  payment attestation, package and policy hashes, local pause, input limits and
  fresh positive readiness. Each failure has a bounded error code.
- `apps/worker/src/broker-router.ts` and
  `apps/worker/src/selected-local-file.ts`: each allowed tool is matched to
  its declared permission and concrete broker port. The selected-file broker
  checks a version/job-scoped authorization before reading bounded bytes;
  there is no generic host-file pass-through or write route.
- `packages/sandbox-adapter/src/docker.ts`: the Docker create argument list
  states every namespace, mount, identity, capability, resource and network
  restriction. The adapter checks the effective container configuration and
  returns named failures when Docker/image/policy checks fail.
- `packages/worker-protocol/src/messages.ts` and Web buyer/Worker handlers:
  external messages use strict schemas and authenticated identities rather
  than an untyped generic dispatch payload.

The current source search for TypeScript `any` in `packages/` and `apps/`
found no type uses; its matches are prose or HTML input attributes. This
review found no generic abstraction that bypasses the named admission,
financial, broker or sandbox decisions. `pnpm typecheck`, `pnpm lint`, the
architecture tests and the M08/M16 PostgreSQL, Worker and real Docker suites
are executable regressions for these explicit paths. This is a code-quality
assessment, not a substitute for the independent security review required
by §91 or for a Stripe-funded release test.
