# Independent post-M17 adversarial audit — in progress

This record starts from the original normative recovery, security, payment,
provider and release requirements. It does not adopt M17's completion claims
as proof. A structural catalog index is not a semantic requirement audit.

## Discrepancies independently reproduced and corrected

1. **Ambiguous result commit could lose a paid deliverable.** Master Spec
   Recovery and reconciliation requires lost finalization acknowledgements
   to converge without losing durable results (`ASYNC-026`). In
   `PostgresJobExecutionRepository.finalizeResult`, the exception handler
   deleted copied private objects after any error, including a lost `COMMIT`
   acknowledgement after PostgreSQL committed the manifest. The cloud now
   preserves copies once commit is attempted. The disposable PostgreSQL
   test injects that precise fault, checks the committed object bytes and
   replays the same finalization. The M08 PostgreSQL test now also creates a
   fresh finance service after durable completion and proves terminal
   reconciliation settles once, even with subsequent concurrent retries.
   `ASYNC-026` is `TESTED` component evidence;
   installed Worker, provider parity and restart/reconnect evidence remain.
2. **Release evidence accepted unrelated files.** The release command
   previously accepted any existing path for provider conformance, security
   matrix and external review evidence, and accepted a passing JSON for a
   different full E2E gate. The validator now requires a structured report
   naming its exact gate and evidence class, with passing steps or explicit
   external review metadata. A regression test rejects unrelated text,
   component-only reports, wrong-gate reports and failing steps. This is
   format validation, not proof that a self-supplied attestation is genuine;
   release owners must inspect the referenced real test/review evidence.
3. **Worker HELLO misreported its release.** The shared dispatch loop sent
   `0.0.0-dev` in every HELLO, even when its readiness/heartbeat configuration
   identified a different installed release. That makes protocol/version
   diagnostics and minimum-version policy inconsistent. It now sends the
   configured release; `tests/worker-dispatch-loop.test.mjs` checks a
   non-development release. The production paid Worker composition remains
   missing, so this is a component correction rather than portability closure.

## Executed evidence in this pass

- `pnpm typecheck`: pass.
- `pnpm lint` and architecture fitness: pass.
- `pnpm test`: 245 cases; 240 pass, 5 environment-dependent skips.
- `pnpm test:postgres:m07`: 9 pass, including commit-acknowledgement fault.
- `pnpm test:postgres:m08`: financial integration pass.
- `pnpm test:boundaries:m16`: 28/28 component steps passed; report at
  `docs/evidence/post-m17-component-matrix.json` is explicitly
  `COMPONENT_ONLY` and does not close full E2E/provider gates.
- `node --test tests/m16-verification-audit.test.mjs`: 4 pass.
- `pnpm build && node --test tests/worker-dispatch-loop.test.mjs`: 4 pass.
- `pnpm verification:audit`: 1,954 rows counted; 563 open implementation
  and 359 deferred verification rows tracked.
- `pnpm release:gate`: **fails closed**, 1,303 mandatory rows not finally
  verified and all ten full release evidence gates absent.
- `git diff --check`: pass.

## Remaining claims that cannot be made

This pass has **not** traced all 1,954 mandatory rows through reachable
production code and executable behavior. The original plan includes M18–M34
after M17. Authenticated seller publication and consent, the production paid
host-native Worker composition, a real Stripe-funded two-user E2E, complete
Netsons/AWS composition roots and provider conformance are still missing.
External staging access, test-mode Stripe credentials, professional review and
private-alpha evidence are also unavailable in this local environment.
No requirement was marked `VERIFIED` by this pass, and the original Kivro
specification is not yet fully implemented or verified.
