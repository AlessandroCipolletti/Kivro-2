# Kivro Implementation Coverage

> Living evidence matrix. Codex must update this file while
> implementing. Do not trust this file during final audit: verify every
> claim against code/tests.

## Status vocabulary

`TODO` · `IN_PROGRESS` · `IMPLEMENTED` · `TESTED` · `VERIFIED` ·
`DEFERRED_VERIFICATION` · `BLOCKED` · `DEFERRED`

`DEFERRED_VERIFICATION` is OPEN and may include dependent implementation
that does not yet exist. Each such ID has a dependency and exact closing
evidence in `docs/verification-backlog.md`. Revisit it as soon as the
dependent milestone introduces the missing component. `VERIFIED` means
the requirement's full required evidence exists; `TESTED` is retained
for existing rows but must not be used as a substitute for full
verification.

`DEFERRED` is valid only when the Master Spec explicitly places the
feature post-MVP or the user explicitly approves the deferral.

  --------------------------------------------------------------------------------
  Requirement   Priority   Source   Status   Implementation   Test       Notes
                                             evidence         evidence   
  ------------- ---------- -------- -------- ---------------- ---------- ---------
  `PRD-0001`    P1         §1       `TODO`   ---              ---        ---

  `PRD-0002`    P2         §1       `TODO`   ---              ---        ---

  `PRD-0003`    P2         §1       `TODO`   ---              ---        ---

  `PRD-0004`    P2         §1       `TODO`   ---              ---        ---

  `PRD-0005`    P2         §1       `TODO`   ---              ---        ---

  `PRD-0006`    P2         §1       `TODO`   ---              ---        ---

  `PRD-0007`    P2         §1       `TODO`   ---              ---        ---

  `WRK-0001`    P1         §2       `TODO`   ---              ---        ---

  `WRK-0002`    P1         §2       `TODO`   ---              ---        ---

  `WRK-0003`    P1         §2       `TODO`   ---              ---        ---

  `WRK-0004`    P1         §2       `TODO`   ---              ---        ---

  `WRK-0005`    P1         §2       `TODO`   ---              ---        ---

  `WRK-0006`    P1         §2       `TODO`   ---              ---        ---

  `WRK-0007`    P1         §2       `TODO`   ---              ---        ---

  `WRK-0008`    P1         §2       `TODO`   ---              ---        ---

  `WRK-0009`    P1         §2       `TODO`   ---              ---        ---

  `PRD-0008`    P1         §3       `TODO`   ---              ---        ---

  `PRD-0009`    P2         §3       `TODO`   ---              ---        ---

  `PRD-0010`    P2         §3       `TODO`   ---              ---        ---

  `PRD-0011`    P2         §3       `TODO`   ---              ---        ---

  `PRD-0012`    P2         §3       `TODO`   ---              ---        ---

  `PRD-0013`    P1         §4       `DEFERRED_VERIFICATION`   packages/contracts/src/account.ts,packages/domain/src/account.ts tests/account.test.mjs baseline only;  backlog:PRD-0013

  `PRD-0014`    P2         §4       `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0014

  `PRD-0015`    P2         §4       `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0015

  `PRD-0016`    P1         §5       `TODO`   ---              ---        ---

  `PRD-0017`    P2         §5       `TODO`   ---              ---        ---

  `PRD-0018`    P2         §5       `TODO`   ---              ---        ---

  `PRD-0019`    P2         §5       `TODO`   ---              ---        ---

  `PRD-0020`    P2         §5       `TODO`   ---              ---        ---

  `PRD-0021`    P2         §5       `TODO`   ---              ---        ---

  `WRK-0010`    P1         §6       `TODO`   ---              ---        ---

  `WRK-0011`    P1         §7       `TODO`   ---              ---        ---

  `WRK-0012`    P1         §7       `TODO`   ---              ---        ---

  `WRK-0013`    P1         §7       `TODO`   ---              ---        ---

  `WRK-0014`    P1         §7       `IN_PROGRESS`   packages/openclaw-adapter/src/discovery.ts   tests/openclaw-discovery.test.mjs   Version detected; compatibility unverified

  `WRK-0015`    P1         §7       `IN_PROGRESS`   packages/openclaw-adapter/src/command-runner.ts   tests/openclaw-discovery.test.mjs   Live scan limited to safe version probe

  `WRK-0016`    P1         §7       `IN_PROGRESS`   packages/openclaw-adapter/src/command-runner.ts   tests/openclaw-discovery.test.mjs   Personal-state config/skill commands disabled

  `WRK-0017`    P1         §7       `TODO`   ---              ---        ---

  `WRK-0018`    P1         §7       `TODO`   ---              ---        ---

  `WRK-0019`    P1         §7       `TODO`   ---              ---        ---

  `WRK-0020`    P1         §7       `TODO`   ---              ---        ---

  `WRK-0021`    P1         §7       `TODO`   ---              ---        ---

  `WRK-0022`    P1         §7       `TODO`   ---              ---        ---

  `WRK-0023`    P1         §7       `TODO`   ---              ---        ---

  `WRK-0024`    P1         §7       `IN_PROGRESS`   packages/openclaw-adapter/src/worker-environment.ts   tests/worker-environment.test.mjs; tools/test-openclaw-isolated.mjs   Dedicated state/config paths; no runtime execution

  `WRK-0025`    P1         §7       `IN_PROGRESS`   packages/openclaw-adapter/src/worker-environment.ts   tests/worker-environment.test.mjs   New empty workspace/state; no sessions copied

  `WRK-0026`    P1         §7       `IN_PROGRESS`   packages/openclaw-adapter/src/worker-environment.ts   tests/worker-environment.test.mjs   No personal files imported by builder

  `WRK-0027`    P1         §7       `TODO`   ---              ---        ---

  `WRK-0028`    P1         §7       `IN_PROGRESS`   packages/openclaw-adapter/src/worker-environment.ts   tests/worker-environment.test.mjs   Config baseline only; effective sandbox M04

  `WRK-0029`    P1         §7       `IN_PROGRESS`   apps/worker/src/cli.ts   tests/worker-cli.test.mjs   Doctor health remains NOT_READY

  `WRK-0030`    P1         §7       `IN_PROGRESS`   apps/worker/src/cli.ts   tests/worker-cli.test.mjs   All execution readiness checks still pending

  `PRD-0022`    P1         §8       `DEFERRED_VERIFICATION`   packages/contracts/src/capability-io.ts tests/capability-io.test.mjs baseline only;  backlog:PRD-0022

  `PRD-0023`    P2         §8       `DEFERRED_VERIFICATION`   packages/contracts/src/capability-io.ts tests/capability-io.test.mjs baseline only;  backlog:PRD-0023

  `PRD-0024`    P2         §8       `DEFERRED_VERIFICATION`   packages/contracts/src/contract-values.ts tests/capability-io.test.mjs baseline only;  backlog:PRD-0024

  `PRD-0025`    P2         §8       `DEFERRED_VERIFICATION`   packages/contracts/src/contract-values.ts tests/capability-io.test.mjs baseline only;  backlog:PRD-0025

  `PRD-0026`    P2         §8       `DEFERRED_VERIFICATION`   packages/contracts/src/contract-values.ts tests/capability-io.test.mjs baseline only;  backlog:PRD-0026

  `PRD-0027`    P2         §8       `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0027

  `PRD-0028`    P2         §8       `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0028

  `PRD-0029`    P2         §8       `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0029

  `PRD-0030`    P2         §8       `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0030

  `JOB-0001`    P1         §9       `DEFERRED_VERIFICATION`   packages/contracts/src/job-lifecycle.ts,packages/domain/src/job-lifecycle.ts tests/job-lifecycle.test.mjs baseline only;  backlog:JOB-0001

  `JOB-0002`    P1         §9       `DEFERRED_VERIFICATION`   packages/domain/src/job-lifecycle.ts tests/job-lifecycle.test.mjs baseline only;  backlog:JOB-0002

  `JOB-0003`    P1         §9       `DEFERRED_VERIFICATION`   packages/domain/src/job-lifecycle.ts,packages/persistence/migrations/0001_foundation.sql tests/job-lifecycle.test.mjs,tests/sql/m01_foundation.sql baseline only;  backlog:JOB-0003

  `JOB-0004`    P1         §9       `DEFERRED_VERIFICATION`   packages/contracts/src/job-lifecycle.ts,packages/persistence/migrations/0001_foundation.sql tests/job-lifecycle.test.mjs,tests/sql/m01_foundation.sql baseline only;  backlog:JOB-0004

  `WRK-0031`    P1         §10      `TODO`   ---              ---        ---

  `WRK-0032`    P1         §10      `TODO`   ---              ---        ---

  `WRK-0033`    P1         §10      `TODO`   ---              ---        ---

  `WRK-0034`    P1         §10      `TODO`   ---              ---        ---

  `WRK-0035`    P1         §10      `TODO`   ---              ---        ---

  `JOB-0005`    P1         §11      `TODO`   ---              ---        ---

  `JOB-0006`    P1         §11      `TODO`   ---              ---        ---

  `JOB-0007`    P1         §11      `TODO`   ---              ---        ---

  `IO-0001`     P1         §12      `TODO`   ---              ---        ---

  `IO-0002`     P1         §12      `TODO`   ---              ---        ---

  `IO-0003`     P1         §12      `TODO`   ---              ---        ---

  `IO-0004`     P1         §12      `TODO`   ---              ---        ---

  `IO-0005`     P1         §12      `TODO`   ---              ---        ---

  `IO-0006`     P1         §12      `TODO`   ---              ---        ---

  `SEC-0001`    P1         §13      `TODO`   ---              ---        ---

  `SEC-0002`    P0         §13      `TODO`   ---              ---        ---

  `SEC-0003`    P0         §13      `TODO`   ---              ---        ---

  `SEC-0004`    P0         §13      `TODO`   ---              ---        ---

  `SEC-0005`    P0         §13      `TODO`   ---              ---        ---

  `SEC-0006`    P0         §13      `TODO`   ---              ---        ---

  `SEC-0007`    P0         §13      `TODO`   ---              ---        ---

  `SEC-0008`    P0         §13      `TODO`   ---              ---        ---

  `SEC-0009`    P1         §14      `TODO`   ---              ---        ---

  `SEC-0010`    P0         §14      `TODO`   ---              ---        ---

  `SEC-0011`    P0         §14      `TODO`   ---              ---        ---

  `SEC-0012`    P0         §14      `TODO`   ---              ---        ---

  `SEC-0013`    P0         §14      `TODO`   ---              ---        ---

  `SEC-0014`    P0         §14      `TODO`   ---              ---        ---

  `SEC-0015`    P0         §14      `TODO`   ---              ---        ---

  `WRK-0036`    P1         §15      `TODO`   ---              ---        ---

  `WRK-0037`    P1         §15      `TODO`   ---              ---        ---

  `WRK-0038`    P1         §15      `TODO`   ---              ---        ---

  `WRK-0039`    P1         §15      `TODO`   ---              ---        ---

  `WRK-0040`    P1         §15      `TODO`   ---              ---        ---

  `WRK-0041`    P1         §15      `TODO`   ---              ---        ---

  `WRK-0042`    P1         §15      `TODO`   ---              ---        ---

  `SEC-0016`    P1         §16      `TODO`   ---              ---        ---

  `SEC-0017`    P0         §16      `TODO`   ---              ---        ---

  `SEC-0018`    P0         §16      `TODO`   ---              ---        ---

  `SEC-0019`    P0         §16      `TODO`   ---              ---        ---

  `SEC-0020`    P0         §16      `TODO`   ---              ---        ---

  `SEC-0021`    P0         §16      `TODO`   ---              ---        ---

  `SEC-0022`    P1         §17      `TODO`   ---              ---        ---

  `SEC-0023`    P0         §17      `TODO`   ---              ---        ---

  `SEC-0024`    P0         §17      `TODO`   ---              ---        ---

  `SEC-0025`    P0         §17      `TODO`   ---              ---        ---

  `PRD-0031`    P1         §18      `TODO`   ---              ---        ---

  `PRD-0032`    P2         §18      `TODO`   ---              ---        ---

  `PRD-0033`    P2         §18      `TODO`   ---              ---        ---

  `PRD-0034`    P2         §18      `TODO`   ---              ---        ---

  `PRD-0035`    P2         §18      `TODO`   ---              ---        ---

  `PRD-0036`    P2         §18      `TODO`   ---              ---        ---

  `PRD-0037`    P2         §18      `TODO`   ---              ---        ---

  `PRD-0038`    P2         §18      `TODO`   ---              ---        ---

  `JOB-0008`    P1         §19      `TODO`   ---              ---        ---

  `JOB-0009`    P1         §19      `TODO`   ---              ---        ---

  `JOB-0010`    P1         §19      `TODO`   ---              ---        ---

  `JOB-0011`    P1         §19      `TODO`   ---              ---        ---

  `JOB-0012`    P1         §19      `TODO`   ---              ---        ---

  `JOB-0013`    P1         §19      `TODO`   ---              ---        ---

  `JOB-0014`    P1         §19      `TODO`   ---              ---        ---

  `JOB-0015`    P1         §19      `TODO`   ---              ---        ---

  `JOB-0016`    P1         §19      `TODO`   ---              ---        ---

  `JOB-0017`    P1         §19      `TODO`   ---              ---        ---

  `JOB-0018`    P1         §19      `TODO`   ---              ---        ---

  `JOB-0019`    P1         §19      `TODO`   ---              ---        ---

  `JOB-0020`    P1         §19      `TODO`   ---              ---        ---

  `JOB-0021`    P1         §19      `TODO`   ---              ---        ---

  `JOB-0022`    P1         §19      `TODO`   ---              ---        ---

  `JOB-0023`    P1         §19      `TODO`   ---              ---        ---

  `JOB-0024`    P1         §19      `TODO`   ---              ---        ---

  `JOB-0025`    P1         §19      `TODO`   ---              ---        ---

  `SEC-0026`    P1         §20      `TODO`   ---              ---        ---

  `SEC-0027`    P0         §20      `TODO`   ---              ---        ---

  `SEC-0028`    P0         §20      `TODO`   ---              ---        ---

  `SEC-0029`    P0         §20      `TODO`   ---              ---        ---

  `SEC-0030`    P0         §20      `TODO`   ---              ---        ---

  `SEC-0031`    P0         §20      `TODO`   ---              ---        ---

  `WRK-0043`    P1         §21      `TODO`   ---              ---        ---

  `WRK-0044`    P1         §21      `TODO`   ---              ---        ---

  `WRK-0045`    P1         §21      `TODO`   ---              ---        ---

  `WRK-0046`    P1         §22      `TODO`   ---              ---        ---

  `WRK-0047`    P1         §22      `TODO`   ---              ---        ---

  `CAP-0001`    P1         §23      `DEFERRED_VERIFICATION`   packages/persistence/migrations/0001_foundation.sql tests/sql/m01_foundation.sql baseline only;  backlog:CAP-0001

  `PAY-0001`    P1         §24      `TODO`   ---              ---        ---

  `PAY-0002`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0003`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0004`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0005`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0006`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0007`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0008`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0009`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0010`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0011`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0012`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0013`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0014`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0015`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0016`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0017`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0018`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0019`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0020`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0021`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0022`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0023`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0024`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0025`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0026`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0027`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0028`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0029`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0030`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0031`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0032`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0033`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0034`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0035`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0036`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0037`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0038`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0039`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0040`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0041`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0042`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0043`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0044`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0045`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0046`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0047`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0048`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0049`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0050`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0051`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0052`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0053`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0054`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0055`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0056`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0057`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0058`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0059`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0060`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0061`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0062`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0063`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0064`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0065`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0066`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0067`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0068`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0069`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0070`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0071`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0072`    P0         §24      `TODO`   ---              ---        ---

  `PAY-0073`    P0         §24      `TODO`   ---              ---        ---

  `PRD-0039`    P1         §25      `TODO`   ---              ---        ---

  `PRD-0040`    P2         §25      `TODO`   ---              ---        ---

  `PRD-0041`    P2         §25      `TODO`   ---              ---        ---

  `PRD-0042`    P2         §25      `TODO`   ---              ---        ---

  `AVL-0001`    P1         §26      `TODO`   ---              ---        ---

  `AVL-0002`    P1         §26      `TODO`   ---              ---        ---

  `WRK-0048`    P1         §27      `TODO`   ---              ---        ---

  `WRK-0049`    P1         §27      `TODO`   ---              ---        ---

  `WRK-0050`    P1         §27      `TODO`   ---              ---        ---

  `WRK-0051`    P1         §27      `TODO`   ---              ---        ---

  `PRD-0043`    P1         §28      `TODO`   ---              ---        ---

  `OBS-0001`    P1         §29      `TODO`   ---              ---        ---

  `OBS-0002`    P2         §29      `TODO`   ---              ---        ---

  `OBS-0003`    P2         §29      `TODO`   ---              ---        ---

  `SEC-0032`    P1         §30      `TODO`   ---              ---        ---

  `SEC-0033`    P0         §30      `TODO`   ---              ---        ---

  `SEC-0034`    P0         §30      `TODO`   ---              ---        ---

  `IO-0007`     P1         §31      `TODO`   ---              ---        ---

  `IO-0008`     P1         §31      `TODO`   ---              ---        ---

  `IO-0009`     P1         §31      `TODO`   ---              ---        ---

  `CAP-0002`    P1         §32      `TODO`   ---              ---        ---

  `CAP-0003`    P1         §32      `TODO`   ---              ---        ---

  `CAP-0004`    P1         §32      `TODO`   ---              ---        ---

  `SEC-0035`    P1         §33      `TODO`   ---              ---        ---

  `WRK-0052`    P1         §34      `TODO`   ---              ---        ---

  `OBS-0004`    P1         §35      `TODO`   ---              ---        ---

  `JOB-0026`    P1         §36      `TODO`   ---              ---        ---

  `JOB-0027`    P1         §36      `TODO`   ---              ---        ---

  `JOB-0028`    P1         §36      `TODO`   ---              ---        ---

  `JOB-0029`    P1         §36      `TODO`   ---              ---        ---

  `JOB-0030`    P1         §36      `TODO`   ---              ---        ---

  `JOB-0031`    P1         §36      `TODO`   ---              ---        ---

  `PRD-0044`    P1         §37      `TODO`   ---              ---        ---

  `PRD-0045`    P2         §37      `TODO`   ---              ---        ---

  `PRD-0046`    P2         §37      `TODO`   ---              ---        ---

  `PRD-0047`    P1         §38      `TODO`   ---              ---        ---

  `PRD-0048`    P1         §39      `TODO`   ---              ---        ---

  `WRK-0053`    P1         §40      `DEFERRED_VERIFICATION` README.md,packages/ tests/architecture.test.mjs skeleton only backlog:WRK-0053

  `PRD-0049`    P1         §41      `TODO`   ---              ---        ---

  `PRD-0050`    P2         §41      `TODO`   ---              ---        ---

  `CAP-0005`    P1         §42      `TODO`   ---              ---        ---

  `CAP-0006`    P1         §42      `TODO`   ---              ---        ---

  `CAP-0007`    P1         §42      `TODO`   ---              ---        ---

  `SEC-0036`    P1         §43      `TODO`   ---              ---        ---

  `SEC-0037`    P0         §43      `TODO`   ---              ---        ---

  `SEC-0038`    P1         §44      `TODO`   ---              ---        ---

  `SEC-0039`    P0         §44      `TODO`   ---              ---        ---

  `SEC-0040`    P0         §44      `TODO`   ---              ---        ---

  `SEC-0041`    P0         §44      `TODO`   ---              ---        ---

  `PRD-0051`    P1         §45      `TODO`   ---              ---        ---

  `PRD-0052`    P2         §45      `TODO`   ---              ---        ---

  `PRD-0053`    P2         §45      `TODO`   ---              ---        ---

  `PRD-0054`    P1         §46      `TODO`   ---              ---        ---

  `PRD-0055`    P2         §46      `TODO`   ---              ---        ---

  `PRD-0056`    P2         §46      `TODO`   ---              ---        ---

  `PRD-0057`    P1         §47      `TODO`   ---              ---        ---

  `PRD-0058`    P2         §47      `TODO`   ---              ---        ---

  `PRD-0059`    P2         §47      `TODO`   ---              ---        ---

  `PRD-0060`    P2         §47      `TODO`   ---              ---        ---

  `SEC-0042`    P1         §48      `TODO`   ---              ---        ---

  `SEC-0043`    P0         §48      `TODO`   ---              ---        ---

  `WRK-0054`    P1         §49      `DEFERRED_VERIFICATION` packages/openclaw-adapter/src tests/openclaw-discovery.test.mjs Steps 1–4 only; execution and security proof pending backlog:WRK-0054

  `WRK-0055`    P1         §49      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0055

  `WRK-0056`    P1         §49      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0056

  `WRK-0057`    P1         §49      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0057

  `WRK-0058`    P1         §49      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0058

  `WRK-0059`    P1         §50      `TODO`   ---              ---        ---

  `WRK-0060`    P1         §50      `TODO`   ---              ---        ---

  `SEC-0044`    P1         §51      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0044

  `SEC-0045`    P0         §51      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0045

  `SEC-0046`    P0         §51      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0046

  `SEC-0047`    P0         §51      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0047

  `SEC-0048`    P0         §51      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0048

  `SEC-0049`    P0         §51      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0049

  `SEC-0050`    P0         §51      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0050

  `SEC-0051`    P0         §51      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0051

  `SEC-0052`    P0         §51      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0052

  `SEC-0053`    P0         §51      `DEFERRED_VERIFICATION` docs/implementation-status.md --- ongoing status backlog:SEC-0053

  `SEC-0054`    P0         §51      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0054

  `WRK-0061`    P1         §52      `DEFERRED_VERIFICATION` packages/,apps/ tests/architecture.test.mjs no services yet backlog:WRK-0061

  `WRK-0062`    P1         §52      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0062

  `WRK-0063`    P1         §52      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0063

  `IO-0010`     P1         §53      `DEFERRED_VERIFICATION` packages/contracts/src/worker-manifest.ts tests/contracts.test.mjs boundary subset backlog:IO-0010 added:packages/contracts/src/capability-io.ts,packages/contracts/src/contract-values.ts;tests/capability-io.test.mjs

  `IO-0011`     P1         §53      `DEFERRED_VERIFICATION` packages/worker-protocol/src/messages.ts tests/contracts.test.mjs boundary subset backlog:IO-0011 added:packages/contracts/src/capability-io.ts,packages/contracts/src/contract-values.ts;tests/capability-io.test.mjs

  `IO-0012`     P1         §53      `DEFERRED_VERIFICATION` packages/contracts/src/worker-manifest.ts tests/contracts.test.mjs other boundaries pending backlog:IO-0012 added:packages/contracts/src/capability-io.ts,packages/contracts/src/contract-values.ts;tests/capability-io.test.mjs

  `CAP-0008`    P1         §54      `DEFERRED_VERIFICATION` packages/contracts/src/worker-manifest.ts tests/contracts.test.mjs storage/publish pending backlog:CAP-0008 added:packages/contracts/src/worker-manifest.ts,packages/domain/src/capability-version.ts;tests/contracts.test.mjs,tests/capability-version.test.mjs

  `CAP-0009`    P1         §54      `DEFERRED_VERIFICATION`   packages/domain/src/capability-version.ts,packages/persistence/migrations/0001_foundation.sql tests/capability-version.test.mjs,tests/sql/m01_foundation.sql baseline only;  backlog:CAP-0009

  `WRK-0064`    P1         §55      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0064

  `WRK-0065`    P1         §55      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0065

  `WRK-0066`    P1         §55      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0066

  `WRK-0067`    P1         §55      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0067

  `WRK-0068`    P1         §56      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0068

  `WRK-0069`    P1         §56      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0069

  `WRK-0070`    P1         §56      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0070

  `WRK-0071`    P1         §57      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0071

  `WRK-0072`    P1         §57      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0072

  `WRK-0073`    P1         §57      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0073

  `WRK-0074`    P1         §58      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0074

  `WRK-0075`    P1         §58      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0075

  `WRK-0076`    P1         §58      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0076

  `WRK-0077`    P1         §59      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0077

  `WRK-0078`    P1         §59      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0078

  `WRK-0079`    P1         §59      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0079

  `WRK-0080`    P1         §59      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0080

  `WRK-0081`    P1         §59      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0081

  `JOB-0032`    P1         §60      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:JOB-0032

  `JOB-0033`    P1         §60      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:JOB-0033

  `JOB-0034`    P1         §60      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:JOB-0034

  `JOB-0035`    P1         §60      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:JOB-0035

  `JOB-0036`    P1         §60      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:JOB-0036

  `JOB-0037`    P1         §60      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:JOB-0037

  `IO-0013`     P1         §61      `TODO`   ---              ---        ---

  `IO-0014`     P1         §61      `TODO`   ---              ---        ---

  `IO-0015`     P1         §61      `TODO`   ---              ---        ---

  `IO-0016`     P1         §61      `TODO`   ---              ---        ---

  `IO-0017`     P1         §61      `TODO`   ---              ---        ---

  `IO-0018`     P1         §61      `TODO`   ---              ---        ---

  `IO-0019`     P1         §61      `TODO`   ---              ---        ---

  `IO-0020`     P1         §61      `TODO`   ---              ---        ---

  `IO-0021`     P1         §61      `TODO`   ---              ---        ---

  `IO-0022`     P1         §61      `TODO`   ---              ---        ---

  `IO-0023`     P1         §61      `TODO`   ---              ---        ---

  `IO-0024`     P1         §61      `TODO`   ---              ---        ---

  `IO-0025`     P1         §61      `TODO`   ---              ---        ---

  `IO-0026`     P1         §61      `TODO`   ---              ---        ---

  `IO-0027`     P1         §61      `TODO`   ---              ---        ---

  `IO-0028`     P1         §61      `TODO`   ---              ---        ---

  `IO-0029`     P1         §62      `TODO`   ---              ---        ---

  `IO-0030`     P1         §62      `TODO`   ---              ---        ---

  `IO-0031`     P1         §62      `TODO`   ---              ---        ---

  `IO-0032`     P1         §62      `TODO`   ---              ---        ---

  `IO-0033`     P1         §63      `TODO`   ---              ---        ---

  `IO-0034`     P1         §63      `TODO`   ---              ---        ---

  `JOB-0038`    P1         §64      `TODO`   ---              ---        ---

  `JOB-0039`    P1         §64      `TODO`   ---              ---        ---

  `JOB-0040`    P1         §64      `TODO`   ---              ---        ---

  `JOB-0041`    P1         §64      `TODO`   ---              ---        ---

  `PRD-0061`    P1         §65      `TODO`   ---              ---        ---

  `PRD-0062`    P2         §65      `TODO`   ---              ---        ---

  `WRK-0082`    P1         §66      `TODO`   ---              ---        ---

  `WRK-0083`    P1         §66      `TODO`   ---              ---        ---

  `WRK-0084`    P1         §66      `TODO`   ---              ---        ---

  `WRK-0085`    P1         §66      `TODO`   ---              ---        ---

  `WRK-0086`    P1         §66      `TODO`   ---              ---        ---

  `WRK-0087`    P1         §66      `TODO`   ---              ---        ---

  `WRK-0088`    P1         §66      `TODO`   ---              ---        ---

  `WRK-0089`    P1         §66      `TODO`   ---              ---        ---

  `WRK-0090`    P1         §66      `TODO`   ---              ---        ---

  `WRK-0091`    P1         §67      `TODO`   ---              ---        ---

  `WRK-0092`    P1         §67      `TODO`   ---              ---        ---

  `CAP-0010`    P1         §68      `TODO`   ---              ---        ---

  `CAP-0011`    P1         §68      `TODO`   ---              ---        ---

  `CAP-0012`    P1         §68      `TODO`   ---              ---        ---

  `CAP-0013`    P1         §68      `TODO`   ---              ---        ---

  `JOB-0042`    P1         §69      `TODO`   ---              ---        ---

  `JOB-0043`    P1         §69      `TODO`   ---              ---        ---

  `JOB-0044`    P1         §70      `TODO`   ---              ---        ---

  `JOB-0045`    P1         §70      `TODO`   ---              ---        ---

  `JOB-0046`    P1         §70      `TODO`   ---              ---        ---

  `JOB-0047`    P1         §70      `TODO`   ---              ---        ---

  `SEC-0055`    P1         §71      `TODO`   ---              ---        ---

  `SEC-0056`    P0         §71      `TODO`   ---              ---        ---

  `SEC-0057`    P1         §72      `TODO`   ---              ---        ---

  `SEC-0058`    P0         §72      `TODO`   ---              ---        ---

  `SEC-0059`    P0         §72      `TODO`   ---              ---        ---

  `SEC-0060`    P0         §72      `TODO`   ---              ---        ---

  `SEC-0061`    P0         §72      `TODO`   ---              ---        ---

  `API-0001`    P1         §73      `TODO`   ---              ---        ---

  `API-0002`    P1         §73      `TODO`   ---              ---        ---

  `API-0003`    P1         §73      `TODO`   ---              ---        ---

  `API-0004`    P1         §73      `TODO`   ---              ---        ---

  `CAP-0014`    P1         §74      `TODO`   ---              ---        ---

  `CAP-0015`    P1         §74      `TODO`   ---              ---        ---

  `SEC-0062`    P1         §75      `TODO`   ---              ---        ---

  `PRD-0063`    P1         §76      `TODO`   ---              ---        ---

  `PRD-0064`    P2         §76      `TODO`   ---              ---        ---

  `PRD-0065`    P2         §76      `TODO`   ---              ---        ---

  `CAP-0016`    P1         §77      `TODO`   ---              ---        ---

  `CAP-0017`    P1         §77      `TODO`   ---              ---        ---

  `JOB-0048`    P1         §78      `TODO`   ---              ---        ---

  `JOB-0049`    P1         §78      `TODO`   ---              ---        ---

  `SEC-0063`    P1         §79      `TODO`   ---              ---        ---

  `SEC-0064`    P0         §79      `TODO`   ---              ---        ---

  `TST-0001`    P1         §80      `TODO`   ---              ---        ---

  `TST-0002`    P2         §80      `TODO`   ---              ---        ---

  `TST-0003`    P2         §80      `TODO`   ---              ---        ---

  `TST-0004`    P2         §80      `TODO`   ---              ---        ---

  `TST-0005`    P2         §80      `TODO`   ---              ---        ---

  `PRD-0066`    P1         §81      `TODO`   ---              ---        ---

  `PRD-0067`    P2         §81      `TODO`   ---              ---        ---

  `OPS-0001`    P1         §82      `TODO`   ---              ---        ---

  `OPS-0002`    P2         §82      `TODO`   ---              ---        ---

  `WRK-0093`    P1         §83      `TODO`   ---              ---        ---

  `WRK-0094`    P1         §83      `TODO`   ---              ---        ---

  `WRK-0095`    P1         §83      `TODO`   ---              ---        ---

  `WRK-0096`    P1         §83      `TODO`   ---              ---        ---

  `OBS-0005`    P1         §84      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:OBS-0005

  `OBS-0006`    P2         §84      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:OBS-0006

  `PRD-0068`    P1         §85      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0068

  `PRD-0069`    P2         §85      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0069

  `PRD-0070`    P1         §86      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0070

  `PRD-0071`    P2         §86      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0071

  `PRD-0072`    P2         §86      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0072

  `PAY-0074`    P1         §87      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PAY-0074

  `IO-0035`     P1         §88      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:IO-0035

  `IO-0036`     P1         §88      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:IO-0036

  `WRK-0097`    P1         §89      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0097

  `WRK-0098`    P1         §89      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:WRK-0098

  `IO-0037`     P1         §90      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:IO-0037

  `TST-0006`    P1         §91      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:TST-0006

  `TST-0007`    P2         §91      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:TST-0007

  `TST-0008`    P1         §92      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:TST-0008

  `TST-0009`    P2         §92      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:TST-0009

  `TST-0010`    P2         §92      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:TST-0010

  `TST-0011`    P2         §92      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:TST-0011

  `TST-0012`    P2         §92      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:TST-0012

  `IO-0038`     P1         §93      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:IO-0038

  `IO-0039`     P1         §93      `DEFERRED_VERIFICATION` packages/openclaw-adapter/src,docs/openclaw-interfaces.md tests/openclaw-discovery.test.mjs Live version only; skill/config parsers fixture-only after unsafe CLI behavior backlog:IO-0039

  `IO-0040`     P1         §93      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:IO-0040

  `IO-0041`     P1         §93      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:IO-0041

  `TST-0013`    P1         §94      `DEFERRED_VERIFICATION` tsconfig.json,package.json tests/*.test.mjs DB/financial gates pending backlog:TST-0013

  `TST-0014`    P2         §94      `VERIFIED` .env.example     tests/env.test.mjs no values in template

  `TST-0015`    P2         §94      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:TST-0015

  `PRD-0073`    P1         §95      `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0073

  `PRD-0074`    P1         §96      `TODO`   ---              ---        ---

  `PRD-0075`    P2         §96      `TODO`   ---              ---        ---

  `PRD-0076`    P2         §96      `TODO`   ---              ---        ---

  `PRD-0077`    P2         §96      `TODO`   ---              ---        ---

  `PRD-0078`    P2         §96      `TODO`   ---              ---        ---

  `PRD-0079`    P2         §96      `TODO`   ---              ---        ---

  `AGT-0001`    P1         §97      `TODO`   ---              ---        ---

  `AGT-0002`    P1         §97      `TODO`   ---              ---        ---

  `AGT-0003`    P1         §97      `TODO`   ---              ---        ---

  `AGT-0004`    P1         §97      `TODO`   ---              ---        ---

  `AGT-0005`    P1         §98      `TODO`   ---              ---        ---

  `AGT-0006`    P1         §98      `TODO`   ---              ---        ---

  `AGT-0007`    P1         §98      `TODO`   ---              ---        ---

  `AGT-0008`    P1         §98      `TODO`   ---              ---        ---

  `AGT-0009`    P1         §99      `TODO`   ---              ---        ---

  `AGT-0010`    P1         §99      `TODO`   ---              ---        ---

  `AGT-0011`    P1         §99      `TODO`   ---              ---        ---

  `AGT-0012`    P1         §99      `TODO`   ---              ---        ---

  `AGT-0013`    P1         §99      `TODO`   ---              ---        ---

  `AGT-0014`    P1         §99      `TODO`   ---              ---        ---

  `AGT-0015`    P1         §100     `TODO`   ---              ---        ---

  `AGT-0016`    P1         §100     `TODO`   ---              ---        ---

  `AGT-0017`    P1         §100     `TODO`   ---              ---        ---

  `AGT-0018`    P1         §100     `TODO`   ---              ---        ---

  `AGT-0019`    P1         §100     `TODO`   ---              ---        ---

  `AGT-0020`    P1         §101     `TODO`   ---              ---        ---

  `AGT-0021`    P1         §101     `TODO`   ---              ---        ---

  `AGT-0022`    P1         §101     `TODO`   ---              ---        ---

  `CAP-0018`    P1         §102     `TODO`   ---              ---        ---

  `CAP-0019`    P1         §102     `TODO`   ---              ---        ---

  `CAP-0020`    P1         §102     `TODO`   ---              ---        ---

  `CAP-0021`    P1         §103     `TODO`   ---              ---        ---

  `AGT-0023`    P1         §104     `TODO`   ---              ---        ---

  `AGT-0024`    P1         §104     `TODO`   ---              ---        ---

  `AGT-0025`    P1         §104     `TODO`   ---              ---        ---

  `AGT-0026`    P1         §104     `TODO`   ---              ---        ---

  `AGT-0027`    P1         §104     `TODO`   ---              ---        ---

  `CAP-0022`    P1         §105     `TODO`   ---              ---        ---

  `CAP-0023`    P1         §105     `TODO`   ---              ---        ---

  `CAP-0024`    P1         §105     `TODO`   ---              ---        ---

  `CAP-0025`    P1         §105     `TODO`   ---              ---        ---

  `UI-0001`     P1         §106     `TODO`   ---              ---        ---

  `UI-0002`     P2         §106     `TODO`   ---              ---        ---

  `UI-0003`     P2         §106     `TODO`   ---              ---        ---

  `UI-0004`     P2         §106     `TODO`   ---              ---        ---

  `UI-0005`     P2         §106     `TODO`   ---              ---        ---

  `UI-0006`     P2         §106     `TODO`   ---              ---        ---

  `UI-0007`     P2         §106     `TODO`   ---              ---        ---

  `UI-0008`     P1         §107     `TODO`   ---              ---        ---

  `UI-0009`     P2         §107     `TODO`   ---              ---        ---

  `UI-0010`     P2         §107     `TODO`   ---              ---        ---

  `UI-0011`     P2         §107     `TODO`   ---              ---        ---

  `UI-0012`     P2         §107     `TODO`   ---              ---        ---

  `UI-0013`     P2         §107     `TODO`   ---              ---        ---

  `UI-0014`     P2         §107     `TODO`   ---              ---        ---

  `UI-0015`     P2         §107     `TODO`   ---              ---        ---

  `CAP-0026`    P1         §108     `TODO`   ---              ---        ---

  `CAP-0027`    P1         §108     `TODO`   ---              ---        ---

  `CAP-0028`    P1         §108     `TODO`   ---              ---        ---

  `CAP-0029`    P1         §108     `TODO`   ---              ---        ---

  `CAP-0030`    P1         §108     `TODO`   ---              ---        ---

  `CAP-0031`    P1         §108     `TODO`   ---              ---        ---

  `CAP-0032`    P1         §108     `TODO`   ---              ---        ---

  `AGT-0028`    P1         §109     `TODO`   ---              ---        ---

  `AGT-0029`    P1         §109     `TODO`   ---              ---        ---

  `AGT-0030`    P1         §109     `TODO`   ---              ---        ---

  `AGT-0031`    P1         §109     `TODO`   ---              ---        ---

  `AGT-0032`    P1         §109     `TODO`   ---              ---        ---

  `CAP-0033`    P1         §110     `TODO`   ---              ---        ---

  `CAP-0034`    P1         §110     `TODO`   ---              ---        ---

  `CAP-0035`    P1         §110     `TODO`   ---              ---        ---

  `CAP-0036`    P1         §110     `TODO`   ---              ---        ---

  `CAP-0037`    P1         §111     `TODO`   ---              ---        ---

  `CAP-0038`    P1         §111     `TODO`   ---              ---        ---

  `CAP-0039`    P1         §111     `TODO`   ---              ---        ---

  `CAP-0040`    P1         §111     `TODO`   ---              ---        ---

  `CAP-0041`    P1         §111     `TODO`   ---              ---        ---

  `CAP-0042`    P1         §111     `TODO`   ---              ---        ---

  `CAP-0043`    P1         §112     `TODO`   ---              ---        ---

  `CAP-0044`    P1         §113     `TODO`   ---              ---        ---

  `CAP-0045`    P1         §113     `TODO`   ---              ---        ---

  `CAP-0046`    P1         §113     `TODO`   ---              ---        ---

  `CAP-0047`    P1         §114     `TODO`   ---              ---        ---

  `CAP-0048`    P1         §114     `TODO`   ---              ---        ---

  `SEC-0065`    P1         §115     `TODO`   ---              ---        ---

  `JOB-0050`    P1         §116     `TODO`   ---              ---        ---

  `JOB-0051`    P1         §116     `TODO`   ---              ---        ---

  `JOB-0052`    P1         §116     `TODO`   ---              ---        ---

  `JOB-0053`    P1         §116     `TODO`   ---              ---        ---

  `JOB-0054`    P1         §116     `TODO`   ---              ---        ---

  `JOB-0055`    P1         §116     `TODO`   ---              ---        ---

  `AGT-0033`    P1         §117     `TODO`   ---              ---        ---

  `AGT-0034`    P1         §117     `TODO`   ---              ---        ---

  `CAP-0049`    P1         §118     `TODO`   ---              ---        ---

  `CAP-0050`    P1         §118     `TODO`   ---              ---        ---

  `CAP-0051`    P1         §118     `TODO`   ---              ---        ---

  `PRD-0080`    P1         §119     `TODO`   ---              ---        ---

  `PRD-0081`    P2         §119     `TODO`   ---              ---        ---

  `PRD-0082`    P2         §119     `TODO`   ---              ---        ---

  `PRD-0083`    P1         §120     `DEFERRED_VERIFICATION`   packages/contracts/src/account.ts,packages/domain/src/account.ts tests/account.test.mjs baseline only;  backlog:PRD-0083

  `PRD-0084`    P2         §120     `DEFERRED_VERIFICATION`   packages/contracts/src/account.ts,packages/persistence/migrations/0001_foundation.sql tests/account.test.mjs,tests/sql/m01_foundation.sql baseline only;  backlog:PRD-0084

  `PRD-0085`    P2         §120     `DEFERRED_VERIFICATION`   packages/domain/src/account.ts tests/account.test.mjs baseline only;  backlog:PRD-0085

  `PRD-0086`    P2         §120     `DEFERRED_VERIFICATION`   packages/domain/src/account.ts tests/account.test.mjs baseline only;  backlog:PRD-0086

  `PRD-0087`    P2         §120     `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0087

  `PRD-0088`    P1         §121     `TODO`   ---              ---        ---

  `PRD-0089`    P2         §121     `TODO`   ---              ---        ---

  `PRD-0090`    P1         §122     `TODO`   ---              ---        ---

  `PRD-0091`    P2         §122     `TODO`   ---              ---        ---

  `PRD-0092`    P1         §123     `TODO`   ---              ---        ---

  `PRD-0093`    P2         §123     `TODO`   ---              ---        ---

  `PRD-0094`    P2         §123     `TODO`   ---              ---        ---

  `PRD-0095`    P1         §124     `TODO`   ---              ---        ---

  `PRD-0096`    P2         §124     `TODO`   ---              ---        ---

  `PRD-0097`    P1         §125     `TODO`   ---              ---        ---

  `PRD-0098`    P2         §125     `TODO`   ---              ---        ---

  `CAP-0052`    P1         §126     `TODO`   ---              ---        ---

  `JOB-0056`    P1         §127     `TODO`   ---              ---        ---

  `JOB-0057`    P1         §127     `TODO`   ---              ---        ---

  `JOB-0058`    P1         §127     `TODO`   ---              ---        ---

  `JOB-0059`    P1         §127     `TODO`   ---              ---        ---

  `PRD-0099`    P1         §128     `TODO`   ---              ---        ---

  `PRD-0100`    P2         §128     `TODO`   ---              ---        ---

  `PRD-0101`    P1         §129     `TODO`   ---              ---        ---

  `PRD-0102`    P2         §129     `TODO`   ---              ---        ---

  `PRD-0103`    P1         §130     `TODO`   ---              ---        ---

  `PRD-0104`    P2         §130     `TODO`   ---              ---        ---

  `PRD-0105`    P1         §131     `TODO`   ---              ---        ---

  `PRD-0106`    P2         §131     `TODO`   ---              ---        ---

  `PRD-0107`    P2         §131     `TODO`   ---              ---        ---

  `PRD-0108`    P2         §131     `TODO`   ---              ---        ---

  `PRD-0109`    P2         §131     `TODO`   ---              ---        ---

  `PRD-0110`    P1         §132     `TODO`   ---              ---        ---

  `PRD-0111`    P2         §132     `TODO`   ---              ---        ---

  `PRD-0112`    P1         §133     `TODO`   ---              ---        ---

  `PRD-0113`    P2         §133     `TODO`   ---              ---        ---

  `PRD-0114`    P2         §133     `TODO`   ---              ---        ---

  `PRD-0115`    P2         §133     `TODO`   ---              ---        ---

  `PRD-0116`    P1         §134     `TODO`   ---              ---        ---

  `AGT-0035`    P1         §135     `TODO`   ---              ---        ---

  `AGT-0036`    P1         §135     `TODO`   ---              ---        ---

  `AGT-0037`    P1         §135     `TODO`   ---              ---        ---

  `PRD-0117`    P1         §136     `TODO`   ---              ---        ---

  `PRD-0118`    P2         §136     `TODO`   ---              ---        ---

  `AGT-0038`    P1         §137     `TODO`   ---              ---        ---

  `AGT-0039`    P1         §137     `TODO`   ---              ---        ---

  `PRD-0119`    P1         §138     `TODO`   ---              ---        ---

  `PRD-0120`    P2         §138     `TODO`   ---              ---        ---

  `PRD-0121`    P2         §138     `TODO`   ---              ---        ---

  `IO-0042`     P1         §139     `TODO`   ---              ---        ---

  `IO-0043`     P1         §139     `TODO`   ---              ---        ---

  `IO-0044`     P1         §139     `TODO`   ---              ---        ---

  `JOB-0060`    P1         §140     `TODO`   ---              ---        ---

  `JOB-0061`    P1         §140     `TODO`   ---              ---        ---

  `JOB-0062`    P1         §140     `TODO`   ---              ---        ---

  `JOB-0063`    P1         §140     `TODO`   ---              ---        ---

  `JOB-0064`    P1         §141     `TODO`   ---              ---        ---

  `JOB-0065`    P1         §141     `TODO`   ---              ---        ---

  `PAY-0075`    P1         §142     `TODO`   ---              ---        ---

  `PAY-0076`    P0         §142     `TODO`   ---              ---        ---

  `PAY-0077`    P0         §142     `TODO`   ---              ---        ---

  `AGT-0040`    P1         §143     `TODO`   ---              ---        ---

  `AGT-0041`    P1         §143     `TODO`   ---              ---        ---

  `AGT-0042`    P1         §143     `TODO`   ---              ---        ---

  `AGT-0043`    P1         §143     `TODO`   ---              ---        ---

  `AGT-0044`    P1         §143     `TODO`   ---              ---        ---

  `PRD-0122`    P1         §144     `TODO`   ---              ---        ---

  `PRD-0123`    P2         §144     `TODO`   ---              ---        ---

  `PRD-0124`    P2         §144     `TODO`   ---              ---        ---

  `PRD-0125`    P2         §144     `TODO`   ---              ---        ---

  `AGT-0045`    P1         §145     `TODO`   ---              ---        ---

  `AGT-0046`    P1         §145     `TODO`   ---              ---        ---

  `PRD-0126`    P1         §146     `TODO`   ---              ---        ---

  `PRD-0127`    P2         §146     `TODO`   ---              ---        ---

  `PRD-0128`    P2         §146     `TODO`   ---              ---        ---

  `PRD-0129`    P2         §146     `TODO`   ---              ---        ---

  `PRD-0130`    P1         §147     `TODO`   ---              ---        ---

  `PRD-0131`    P2         §147     `TODO`   ---              ---        ---

  `PRD-0132`    P2         §147     `TODO`   ---              ---        ---

  `CAP-0053`    P1         §148     `TODO`   ---              ---        ---

  `CAP-0054`    P1         §148     `TODO`   ---              ---        ---

  `PRD-0133`    P1         §149     `TODO`   ---              ---        ---

  `PRD-0134`    P1         §150     `TODO`   ---              ---        ---

  `PRD-0135`    P2         §150     `TODO`   ---              ---        ---

  `PRD-0136`    P2         §150     `TODO`   ---              ---        ---

  `PRD-0137`    P1         §151     `TODO`   ---              ---        ---

  `PRD-0138`    P2         §151     `TODO`   ---              ---        ---

  `PRD-0139`    P2         §151     `TODO`   ---              ---        ---

  `PRD-0140`    P1         §152     `TODO`   ---              ---        ---

  `PRD-0141`    P2         §152     `TODO`   ---              ---        ---

  `PRD-0142`    P1         §153     `TODO`   ---              ---        ---

  `PRD-0143`    P2         §153     `TODO`   ---              ---        ---

  `PRD-0144`    P1         §154     `TODO`   ---              ---        ---

  `PRD-0145`    P2         §154     `TODO`   ---              ---        ---

  `PRD-0146`    P1         §155     `TODO`   ---              ---        ---

  `PRD-0147`    P2         §155     `TODO`   ---              ---        ---

  `PRD-0148`    P2         §155     `TODO`   ---              ---        ---

  `CAP-0055`    P1         §156     `TODO`   ---              ---        ---

  `IO-0045`     P1         §157     `TODO`   ---              ---        ---

  `IO-0046`     P1         §158     `TODO`   ---              ---        ---

  `IO-0047`     P1         §158     `TODO`   ---              ---        ---

  `IO-0048`     P1         §158     `TODO`   ---              ---        ---

  `IO-0049`     P1         §158     `TODO`   ---              ---        ---

  `PRD-0149`    P1         §159     `TODO`   ---              ---        ---

  `PRD-0150`    P2         §159     `TODO`   ---              ---        ---

  `PRD-0151`    P2         §159     `TODO`   ---              ---        ---

  `PRD-0152`    P1         §160     `TODO`   ---              ---        ---

  `PRD-0153`    P2         §160     `TODO`   ---              ---        ---

  `PRD-0154`    P2         §160     `TODO`   ---              ---        ---

  `PRD-0155`    P1         §161     `TODO`   ---              ---        ---

  `PRD-0156`    P2         §161     `TODO`   ---              ---        ---

  `PRD-0157`    P1         §162     `TODO`   ---              ---        ---

  `PRD-0158`    P2         §162     `TODO`   ---              ---        ---

  `PRD-0159`    P1         §163     `DEFERRED_VERIFICATION`   packages/contracts/src/inference.ts tests/inference.test.mjs baseline only;  backlog:PRD-0159

  `PRD-0160`    P2         §163     `DEFERRED_VERIFICATION`   packages/contracts/src/inference.ts tests/inference.test.mjs baseline only;  backlog:PRD-0160

  `PRD-0161`    P2         §163     `DEFERRED_VERIFICATION`   ---              ---        --- backlog:PRD-0161

  `PRD-0162`    P2         §163     `DEFERRED_VERIFICATION`   packages/contracts/src/inference.ts tests/inference.test.mjs baseline only;  backlog:PRD-0162

  `AGT-0047`    P1         §164     `TODO`   ---              ---        ---

  `AGT-0048`    P1         §164     `TODO`   ---              ---        ---

  `AGT-0049`    P1         §164     `TODO`   ---              ---        ---

  `AGT-0050`    P1         §165     `TODO`   ---              ---        ---

  `AGT-0051`    P1         §165     `TODO`   ---              ---        ---

  `AGT-0052`    P1         §165     `TODO`   ---              ---        ---

  `AGT-0053`    P1         §165     `TODO`   ---              ---        ---

  `AGT-0054`    P1         §165     `TODO`   ---              ---        ---

  `AGT-0055`    P1         §165     `TODO`   ---              ---        ---

  `SEC-0066`    P1         §166     `TODO`   ---              ---        ---

  `SEC-0067`    P0         §166     `TODO`   ---              ---        ---

  `SEC-0068`    P0         §166     `TODO`   ---              ---        ---

  `SEC-0069`    P0         §166     `TODO`   ---              ---        ---

  `AGT-0056`    P1         §167     `TODO`   ---              ---        ---

  `AGT-0057`    P1         §167     `TODO`   ---              ---        ---

  `AGT-0058`    P1         §167     `TODO`   ---              ---        ---

  `AGT-0059`    P1         §167     `TODO`   ---              ---        ---

  `AGT-0060`    P1         §168     `TODO`   ---              ---        ---

  `AGT-0061`    P1         §168     `TODO`   ---              ---        ---

  `AGT-0062`    P1         §168     `TODO`   ---              ---        ---

  `AGT-0063`    P1         §169     `TODO`   ---              ---        ---

  `AGT-0064`    P1         §169     `TODO`   ---              ---        ---

  `AGT-0065`    P1         §170     `TODO`   ---              ---        ---

  `AGT-0066`    P1         §170     `TODO`   ---              ---        ---

  `AGT-0067`    P1         §171     `TODO`   ---              ---        ---

  `AGT-0068`    P1         §171     `TODO`   ---              ---        ---

  `AGT-0069`    P1         §171     `TODO`   ---              ---        ---

  `IO-0050`     P1         §172     `TODO`   ---              ---        ---

  `IO-0051`     P1         §172     `TODO`   ---              ---        ---

  `IO-0052`     P1         §172     `TODO`   ---              ---        ---

  `AGT-0070`    P1         §173     `TODO`   ---              ---        ---

  `AGT-0071`    P1         §173     `TODO`   ---              ---        ---

  `AGT-0072`    P1         §173     `TODO`   ---              ---        ---

  `AGT-0073`    P1         §173     `TODO`   ---              ---        ---

  `PRD-0163`    P1         §174     `TODO`   ---              ---        ---

  `PRD-0164`    P2         §174     `TODO`   ---              ---        ---

  `PRD-0165`    P2         §174     `TODO`   ---              ---        ---

  `AGT-0074`    P1         §175     `TODO`   ---              ---        ---

  `AGT-0075`    P1         §176     `TODO`   ---              ---        ---

  `AGT-0076`    P1         §176     `TODO`   ---              ---        ---

  `PRD-0166`    P1         §177     `TODO`   ---              ---        ---

  `PRD-0167`    P2         §177     `TODO`   ---              ---        ---

  `PRD-0168`    P2         §177     `TODO`   ---              ---        ---

  `PRD-0169`    P2         §177     `TODO`   ---              ---        ---

  `PRD-0170`    P2         §177     `TODO`   ---              ---        ---

  `PRD-0171`    P2         §177     `TODO`   ---              ---        ---

  `PRD-0172`    P1         §178     `TODO`   ---              ---        ---

  `PRD-0173`    P2         §178     `TODO`   ---              ---        ---

  `PRD-0174`    P2         §178     `TODO`   ---              ---        ---

  `PRD-0175`    P1         §179     `TODO`   ---              ---        ---

  `PRD-0176`    P2         §179     `TODO`   ---              ---        ---

  `PRD-0177`    P2         §179     `TODO`   ---              ---        ---

  `PRD-0178`    P2         §179     `TODO`   ---              ---        ---

  `AGT-0077`    P1         §180     `TODO`   ---              ---        ---

  `AGT-0078`    P1         §180     `TODO`   ---              ---        ---

  `AGT-0079`    P1         §181     `TODO`   ---              ---        ---

  `AGT-0080`    P1         §181     `TODO`   ---              ---        ---

  `AGT-0081`    P1         §181     `TODO`   ---              ---        ---

  `AGT-0082`    P1         §181     `TODO`   ---              ---        ---

  `AGT-0083`    P1         §182     `TODO`   ---              ---        ---

  `AGT-0084`    P1         §182     `TODO`   ---              ---        ---

  `AGT-0085`    P1         §182     `TODO`   ---              ---        ---

  `IO-0053`     P1         §183     `TODO`   ---              ---        ---

  `IO-0054`     P1         §183     `TODO`   ---              ---        ---

  `IO-0055`     P1         §183     `TODO`   ---              ---        ---

  `IO-0056`     P1         §183     `TODO`   ---              ---        ---

  `UI-0016`     P1         §184     `TODO`   ---              ---        ---

  `UI-0017`     P2         §184     `TODO`   ---              ---        ---

  `UI-0018`     P2         §184     `TODO`   ---              ---        ---

  `AGT-0086`    P1         §185     `TODO`   ---              ---        ---

  `AGT-0087`    P1         §186     `TODO`   ---              ---        ---

  `AGT-0088`    P1         §186     `TODO`   ---              ---        ---

  `AGT-0089`    P1         §186     `TODO`   ---              ---        ---

  `AGT-0090`    P1         §187     `TODO`   ---              ---        ---

  `AGT-0091`    P1         §187     `TODO`   ---              ---        ---

  `AGT-0092`    P1         §187     `TODO`   ---              ---        ---

  `AGT-0093`    P1         §187     `TODO`   ---              ---        ---

  `PRD-0179`    P1         §188     `TODO`   ---              ---        ---

  `PRD-0180`    P2         §188     `TODO`   ---              ---        ---

  `PRD-0181`    P2         §188     `TODO`   ---              ---        ---

  `PRD-0182`    P2         §188     `TODO`   ---              ---        ---

  `TST-0016`    P1         §189     `TODO`   ---              ---        ---

  `TST-0017`    P2         §189     `TODO`   ---              ---        ---

  `TST-0018`    P2         §189     `TODO`   ---              ---        ---

  `AGT-0094`    P1         §190     `TODO`   ---              ---        ---

  `AGT-0095`    P1         §190     `TODO`   ---              ---        ---

  `AGT-0096`    P1         §190     `TODO`   ---              ---        ---

  `AGT-0097`    P1         §190     `TODO`   ---              ---        ---

  `PRD-0183`    P1         §191     `TODO`   ---              ---        ---

  `PRD-0184`    P2         §191     `TODO`   ---              ---        ---

  `IO-0057`     P1         §192     `DEFERRED_VERIFICATION`   packages/contracts/src/capability-io.ts tests/capability-io.test.mjs baseline only;  backlog:IO-0057

  `IO-0058`     P1         §192     `DEFERRED_VERIFICATION`   packages/contracts/src/capability-io.ts tests/capability-io.test.mjs baseline only;  backlog:IO-0058

  `IO-0059`     P1         §192     `DEFERRED_VERIFICATION`   packages/contracts/src/contract-values.ts tests/capability-io.test.mjs baseline only;  backlog:IO-0059

  `IO-0060`     P1         §192     `DEFERRED_VERIFICATION`   packages/contracts/src/capability-io.ts tests/capability-io.test.mjs baseline only;  backlog:IO-0060

  `IO-0061`     P1         §193     `TODO`   ---              ---        ---

  `IO-0062`     P1         §193     `TODO`   ---              ---        ---

  `IO-0063`     P1         §194     `TODO`   ---              ---        ---

  `IO-0064`     P1         §194     `TODO`   ---              ---        ---

  `IO-0065`     P1         §195     `TODO`   ---              ---        ---

  `IO-0066`     P1         §195     `TODO`   ---              ---        ---

  `IO-0067`     P1         §195     `TODO`   ---              ---        ---

  `UI-0019`     P1         §196     `TODO`   ---              ---        ---

  `IO-0068`     P1         §197     `TODO`   ---              ---        ---

  `IO-0069`     P1         §197     `TODO`   ---              ---        ---

  `IO-0070`     P1         §197     `TODO`   ---              ---        ---

  `UI-0020`     P1         §198     `TODO`   ---              ---        ---

  `UI-0021`     P2         §198     `TODO`   ---              ---        ---

  `IO-0071`     P1         §199     `TODO`   ---              ---        ---

  `PRD-0185`    P1         §200     `TODO`   ---              ---        ---

  `IO-0072`     P1         §201     `TODO`   ---              ---        ---

  `IO-0073`     P1         §201     `TODO`   ---              ---        ---

  `IO-0074`     P1         §202     `TODO`   ---              ---        ---

  `IO-0075`     P1         §202     `TODO`   ---              ---        ---

  `IO-0076`     P1         §202     `TODO`   ---              ---        ---

  `IO-0077`     P1         §203     `TODO`   ---              ---        ---

  `IO-0078`     P1         §203     `TODO`   ---              ---        ---

  `UI-0022`     P1         §204     `TODO`   ---              ---        ---

  `IO-0079`     P1         §205     `TODO`   ---              ---        ---

  `IO-0080`     P1         §205     `TODO`   ---              ---        ---

  `IO-0081`     P1         §205     `TODO`   ---              ---        ---

  `PRD-0186`    P1         §206     `TODO`   ---              ---        ---

  `CAP-0056`    P1         §207     `TODO`   ---              ---        ---

  `PRD-0187`    P1         §208     `TODO`   ---              ---        ---

  `PRD-0188`    P2         §208     `TODO`   ---              ---        ---

  `PRD-0189`    P2         §208     `TODO`   ---              ---        ---

  `IO-0082`     P1         §209     `TODO`   ---              ---        ---

  `IO-0083`     P1         §209     `TODO`   ---              ---        ---

  `CAP-0057`    P1         §210     `TODO`   ---              ---        ---

  `CAP-0058`    P1         §210     `TODO`   ---              ---        ---

  `CAP-0059`    P1         §210     `TODO`   ---              ---        ---

  `IO-0084`     P1         §211     `TODO`   ---              ---        ---

  `IO-0085`     P1         §211     `TODO`   ---              ---        ---

  `IO-0086`     P1         §211     `TODO`   ---              ---        ---

  `IO-0087`     P1         §211     `TODO`   ---              ---        ---

  `IO-0088`     P1         §212     `TODO`   ---              ---        ---

  `IO-0089`     P1         §212     `TODO`   ---              ---        ---

  `IO-0090`     P1         §212     `TODO`   ---              ---        ---

  `IO-0091`     P1         §213     `TODO`   ---              ---        ---

  `IO-0092`     P1         §213     `TODO`   ---              ---        ---

  `IO-0093`     P1         §213     `TODO`   ---              ---        ---

  `IO-0094`     P1         §213     `TODO`   ---              ---        ---

  `IO-0095`     P1         §214     `TODO`   ---              ---        ---

  `IO-0096`     P1         §214     `TODO`   ---              ---        ---

  `IO-0097`     P1         §214     `TODO`   ---              ---        ---

  `IO-0098`     P1         §215     `TODO`   ---              ---        ---

  `IO-0099`     P1         §215     `TODO`   ---              ---        ---

  `IO-0100`     P1         §215     `TODO`   ---              ---        ---

  `IO-0101`     P1         §215     `TODO`   ---              ---        ---

  `IO-0102`     P1         §216     `TODO`   ---              ---        ---

  `IO-0103`     P1         §216     `TODO`   ---              ---        ---

  `IO-0104`     P1         §217     `TODO`   ---              ---        ---

  `IO-0105`     P1         §217     `TODO`   ---              ---        ---

  `IO-0106`     P1         §217     `TODO`   ---              ---        ---

  `IO-0107`     P1         §218     `TODO`   ---              ---        ---

  `IO-0108`     P1         §218     `TODO`   ---              ---        ---

  `IO-0109`     P1         §218     `TODO`   ---              ---        ---

  `IO-0110`     P1         §218     `TODO`   ---              ---        ---

  `CAP-0060`    P1         §219     `TODO`   ---              ---        ---

  `CAP-0061`    P1         §219     `TODO`   ---              ---        ---

  `CAP-0062`    P1         §219     `TODO`   ---              ---        ---

  `IO-0111`     P1         §220     `TODO`   ---              ---        ---

  `IO-0112`     P1         §220     `TODO`   ---              ---        ---

  `IO-0113`     P1         §221     `TODO`   ---              ---        ---

  `IO-0114`     P1         §222     `TODO`   ---              ---        ---

  `IO-0115`     P1         §222     `TODO`   ---              ---        ---

  `IO-0116`     P1         §222     `TODO`   ---              ---        ---

  `IO-0117`     P1         §223     `TODO`   ---              ---        ---

  `PRD-0190`    P1         §224     `TODO`   ---              ---        ---

  `PRD-0191`    P2         §224     `TODO`   ---              ---        ---

  `IO-0118`     P1         §225     `TODO`   ---              ---        ---

  `IO-0119`     P1         §225     `TODO`   ---              ---        ---

  `IO-0120`     P1         §225     `TODO`   ---              ---        ---

  `IO-0121`     P1         §226     `TODO`   ---              ---        ---

  `IO-0122`     P1         §226     `TODO`   ---              ---        ---

  `IO-0123`     P1         §226     `TODO`   ---              ---        ---

  `IO-0124`     P1         §226     `TODO`   ---              ---        ---

  `PRD-0192`    P1         §227     `TODO`   ---              ---        ---

  `PRD-0193`    P2         §227     `TODO`   ---              ---        ---

  `PRD-0194`    P2         §227     `TODO`   ---              ---        ---

  `PRD-0195`    P2         §227     `TODO`   ---              ---        ---

  `IO-0125`     P1         §228     `TODO`   ---              ---        ---

  `IO-0126`     P1         §228     `TODO`   ---              ---        ---

  `IO-0127`     P1         §228     `TODO`   ---              ---        ---

  `PRD-0196`    P1         §229     `TODO`   ---              ---        ---

  `PRD-0197`    P2         §229     `TODO`   ---              ---        ---

  `IO-0128`     P1         §230     `TODO`   ---              ---        ---

  `IO-0129`     P1         §230     `TODO`   ---              ---        ---

  `TST-0019`    P1         §231     `TODO`   ---              ---        ---

  `PAY-0078`    P1         §232     `TODO`   ---              ---        ---

  `PAY-0079`    P0         §232     `TODO`   ---              ---        ---

  `PAY-0080`    P0         §232     `TODO`   ---              ---        ---

  `PRD-0198`    P1         §233     `TODO`   ---              ---        ---

  `PRD-0199`    P2         §233     `TODO`   ---              ---        ---

  `PRD-0200`    P2         §233     `TODO`   ---              ---        ---

  `PRD-0201`    P2         §233     `TODO`   ---              ---        ---

  `IO-0130`     P1         §234     `TODO`   ---              ---        ---

  `IO-0131`     P1         §235     `TODO`   ---              ---        ---

  `IO-0132`     P1         §235     `TODO`   ---              ---        ---

  `PRD-0202`    P1         §236     `TODO`   ---              ---        ---

  `PRD-0203`    P2         §236     `TODO`   ---              ---        ---

  `PRD-0204`    P1         §237     `TODO`   ---              ---        ---

  `PRD-0205`    P2         §237     `TODO`   ---              ---        ---

  `PRD-0206`    P2         §237     `TODO`   ---              ---        ---

  `PRD-0207`    P2         §237     `TODO`   ---              ---        ---

  `PRD-0208`    P2         §237     `TODO`   ---              ---        ---

  `PRD-0209`    P1         §238     `TODO`   ---              ---        ---

  `PRD-0210`    P2         §238     `TODO`   ---              ---        ---

  `PRD-0211`    P2         §238     `TODO`   ---              ---        ---

  `PRD-0212`    P2         §238     `TODO`   ---              ---        ---

  `SEC-0070`    P1         §239     `TODO`   ---              ---        ---

  `SEC-0071`    P0         §239     `TODO`   ---              ---        ---

  `SEC-0072`    P0         §239     `TODO`   ---              ---        ---

  `PRD-0213`    P1         §240     `TODO`   ---              ---        ---

  `PRD-0214`    P1         §241     `TODO`   ---              ---        ---

  `PRD-0215`    P2         §241     `TODO`   ---              ---        ---

  `PRD-0216`    P2         §241     `TODO`   ---              ---        ---

  `UI-0023`     P1         §242     `TODO`   ---              ---        ---

  `SEC-0073`    P1         §243     `TODO`   ---              ---        ---

  `SEC-0074`    P0         §243     `TODO`   ---              ---        ---

  `SEC-0075`    P0         §243     `TODO`   ---              ---        ---

  `PRD-0217`    P1         §244     `TODO`   ---              ---        ---

  `PRD-0218`    P2         §244     `TODO`   ---              ---        ---

  `PRD-0219`    P2         §244     `TODO`   ---              ---        ---

  `PRD-0220`    P1         §245     `TODO`   ---              ---        ---

  `PRD-0221`    P2         §245     `TODO`   ---              ---        ---

  `PRD-0222`    P2         §245     `TODO`   ---              ---        ---

  `PRD-0223`    P2         §245     `TODO`   ---              ---        ---

  `PRD-0224`    P1         §246     `TODO`   ---              ---        ---

  `CAP-0063`    P1         §247     `TODO`   ---              ---        ---

  `CAP-0064`    P1         §247     `TODO`   ---              ---        ---

  `SEC-0076`    P1         §248     `TODO`   ---              ---        ---

  `SEC-0077`    P0         §248     `TODO`   ---              ---        ---

  `PRD-0225`    P1         §249     `TODO`   ---              ---        ---

  `PRD-0226`    P2         §249     `TODO`   ---              ---        ---

  `PRD-0227`    P2         §249     `TODO`   ---              ---        ---

  `IO-0133`     P1         §250     `TODO`   ---              ---        ---

  `IO-0134`     P1         §250     `TODO`   ---              ---        ---

  `IO-0135`     P1         §250     `TODO`   ---              ---        ---

  `PRD-0228`    P1         §251     `TODO`   ---              ---        ---

  `PRD-0229`    P2         §251     `TODO`   ---              ---        ---

  `PRD-0230`    P2         §251     `TODO`   ---              ---        ---

  `SEC-0078`    P1         §252     `TODO`   ---              ---        ---

  `SEC-0079`    P0         §252     `TODO`   ---              ---        ---

  `SEC-0080`    P0         §252     `TODO`   ---              ---        ---

  `SEC-0081`    P0         §252     `TODO`   ---              ---        ---

  `PRD-0231`    P1         §253     `TODO`   ---              ---        ---

  `PRD-0232`    P2         §253     `TODO`   ---              ---        ---

  `PRD-0233`    P1         §254     `TODO`   ---              ---        ---

  `PRD-0234`    P2         §254     `TODO`   ---              ---        ---

  `PRD-0235`    P1         §255     `TODO`   ---              ---        ---

  `PRD-0236`    P1         §256     `TODO`   ---              ---        ---

  `PRD-0237`    P1         §257     `TODO`   ---              ---        ---

  `PRD-0238`    P2         §257     `TODO`   ---              ---        ---

  `PRD-0239`    P1         §258     `TODO`   ---              ---        ---

  `PRD-0240`    P1         §259     `TODO`   ---              ---        ---

  `PRD-0241`    P2         §259     `TODO`   ---              ---        ---

  `PRD-0242`    P1         §260     `TODO`   ---              ---        ---

  `PRD-0243`    P2         §260     `TODO`   ---              ---        ---

  `PRD-0244`    P2         §260     `TODO`   ---              ---        ---

  `PRD-0245`    P1         §261     `TODO`   ---              ---        ---

  `PRD-0246`    P2         §261     `TODO`   ---              ---        ---

  `PRD-0247`    P2         §261     `TODO`   ---              ---        ---

  `PRD-0248`    P1         §262     `TODO`   ---              ---        ---

  `PRD-0249`    P2         §262     `TODO`   ---              ---        ---

  `PRD-0250`    P2         §262     `TODO`   ---              ---        ---

  `API-0005`    P1         §263     `TODO`   ---              ---        ---

  `API-0006`    P1         §263     `TODO`   ---              ---        ---

  `API-0007`    P1         §263     `TODO`   ---              ---        ---

  `PRD-0251`    P1         §264     `TODO`   ---              ---        ---

  `PRD-0252`    P2         §264     `TODO`   ---              ---        ---

  `PRD-0253`    P1         §265     `TODO`   ---              ---        ---

  `PRD-0254`    P2         §265     `TODO`   ---              ---        ---

  `PRD-0255`    P2         §265     `TODO`   ---              ---        ---

  `PRD-0256`    P2         §265     `TODO`   ---              ---        ---

  `PRD-0257`    P2         §265     `TODO`   ---              ---        ---

  `SEC-0082`    P1         §266     `TODO`   ---              ---        ---

  `SEC-0083`    P0         §266     `TODO`   ---              ---        ---

  `SEC-0084`    P0         §266     `TODO`   ---              ---        ---

  `PRD-0258`    P1         §267     `TODO`   ---              ---        ---

  `PRD-0259`    P2         §267     `TODO`   ---              ---        ---

  `SEC-0085`    P1         §268     `TODO`   ---              ---        ---

  `SEC-0086`    P0         §268     `TODO`   ---              ---        ---

  `SEC-0087`    P0         §268     `TODO`   ---              ---        ---

  `PRD-0260`    P1         §269     `TODO`   ---              ---        ---

  `PRD-0261`    P2         §269     `TODO`   ---              ---        ---

  `PRD-0262`    P2         §269     `TODO`   ---              ---        ---

  `PRD-0263`    P2         §269     `TODO`   ---              ---        ---

  `PRD-0264`    P1         §270     `TODO`   ---              ---        ---

  `PRD-0265`    P2         §270     `TODO`   ---              ---        ---

  `PRD-0266`    P1         §271     `TODO`   ---              ---        ---

  `PRD-0267`    P2         §271     `TODO`   ---              ---        ---

  `CAP-0065`    P1         §272     `TODO`   ---              ---        ---

  `CAP-0066`    P1         §272     `TODO`   ---              ---        ---

  `SEC-0088`    P1         §273     `TODO`   ---              ---        ---

  `SEC-0089`    P0         §273     `TODO`   ---              ---        ---

  `PRD-0268`    P1         §274     `TODO`   ---              ---        ---

  `PRD-0269`    P2         §274     `TODO`   ---              ---        ---

  `PRD-0270`    P1         §275     `TODO`   ---              ---        ---

  `PRD-0271`    P2         §275     `TODO`   ---              ---        ---

  `PRD-0272`    P2         §275     `TODO`   ---              ---        ---

  `PRD-0273`    P1         §276     `TODO`   ---              ---        ---

  `PRD-0274`    P2         §276     `TODO`   ---              ---        ---

  `PRD-0275`    P2         §276     `TODO`   ---              ---        ---

  `PRD-0276`    P2         §276     `TODO`   ---              ---        ---

  `SEC-0090`    P1         §277     `TODO`   ---              ---        ---

  `SEC-0091`    P0         §277     `TODO`   ---              ---        ---

  `PRD-0277`    P1         §278     `TODO`   ---              ---        ---

  `PRD-0278`    P2         §278     `TODO`   ---              ---        ---

  `PRD-0279`    P2         §278     `TODO`   ---              ---        ---

  `PRD-0280`    P1         §279     `TODO`   ---              ---        ---

  `PRD-0281`    P2         §279     `TODO`   ---              ---        ---

  `PRD-0282`    P2         §279     `TODO`   ---              ---        ---

  `PRD-0283`    P2         §279     `TODO`   ---              ---        ---

  `PRD-0284`    P1         §280     `TODO`   ---              ---        ---

  `PRD-0285`    P2         §280     `TODO`   ---              ---        ---

  `PRD-0286`    P2         §280     `TODO`   ---              ---        ---

  `PRD-0287`    P1         §281     `TODO`   ---              ---        ---

  `PRD-0288`    P2         §281     `TODO`   ---              ---        ---

  `PRD-0289`    P2         §281     `TODO`   ---              ---        ---

  `PAY-0081`    P1         §282     `TODO`   ---              ---        ---

  `PAY-0082`    P0         §282     `TODO`   ---              ---        ---

  `PAY-0083`    P0         §282     `TODO`   ---              ---        ---

  `PRD-0290`    P1         §283     `TODO`   ---              ---        ---

  `PRD-0291`    P2         §283     `TODO`   ---              ---        ---

  `PRD-0292`    P1         §284     `TODO`   ---              ---        ---

  `PRD-0293`    P1         §285     `TODO`   ---              ---        ---

  `PRD-0294`    P2         §285     `TODO`   ---              ---        ---

  `PRD-0295`    P1         §286     `TODO`   ---              ---        ---

  `PRD-0296`    P1         §287     `TODO`   ---              ---        ---

  `PRD-0297`    P2         §287     `TODO`   ---              ---        ---

  `PRD-0298`    P2         §287     `TODO`   ---              ---        ---

  `PRD-0299`    P2         §287     `TODO`   ---              ---        ---

  `PAY-0084`    P1         §288     `TODO`   ---              ---        ---

  `PAY-0085`    P0         §288     `TODO`   ---              ---        ---

  `PAY-0086`    P0         §288     `TODO`   ---              ---        ---

  `PAY-0087`    P0         §288     `TODO`   ---              ---        ---

  `PAY-0088`    P0         §288     `TODO`   ---              ---        ---

  `PAY-0089`    P1         §289     `TODO`   ---              ---        ---

  `PAY-0090`    P0         §289     `TODO`   ---              ---        ---

  `PAY-0091`    P0         §289     `TODO`   ---              ---        ---

  `PAY-0092`    P1         §290     `TODO`   ---              ---        ---

  `PAY-0093`    P0         §290     `TODO`   ---              ---        ---

  `PAY-0094`    P0         §290     `TODO`   ---              ---        ---

  `PAY-0095`    P0         §290     `TODO`   ---              ---        ---

  `PRD-0300`    P1         §291     `TODO`   ---              ---        ---

  `PRD-0301`    P2         §291     `TODO`   ---              ---        ---

  `PRD-0302`    P1         §292     `TODO`   ---              ---        ---

  `PRD-0303`    P2         §292     `TODO`   ---              ---        ---

  `PAY-0096`    P1         §293     `TODO`   ---              ---        ---

  `PAY-0097`    P0         §293     `TODO`   ---              ---        ---

  `PRD-0304`    P1         §294     `TODO`   ---              ---        ---

  `PRD-0305`    P2         §294     `TODO`   ---              ---        ---

  `PRD-0306`    P1         §295     `TODO`   ---              ---        ---

  `PRD-0307`    P2         §295     `TODO`   ---              ---        ---

  `PAY-0098`    P1         §296     `TODO`   ---              ---        ---

  `PAY-0099`    P0         §296     `TODO`   ---              ---        ---

  `PAY-0100`    P0         §296     `TODO`   ---              ---        ---

  `PAY-0101`    P0         §296     `TODO`   ---              ---        ---

  `PRD-0308`    P1         §297     `TODO`   ---              ---        ---

  `PRD-0309`    P2         §297     `TODO`   ---              ---        ---

  `PRD-0310`    P2         §297     `TODO`   ---              ---        ---

  `PRD-0311`    P2         §297     `TODO`   ---              ---        ---

  `PRD-0312`    P2         §297     `TODO`   ---              ---        ---

  `PRD-0313`    P1         §298     `TODO`   ---              ---        ---

  `PRD-0314`    P2         §298     `TODO`   ---              ---        ---

  `PRD-0315`    P2         §298     `TODO`   ---              ---        ---

  `SEC-0092`    P1         §299     `DEFERRED_VERIFICATION`   packages/contracts/src/permission-policy.ts,packages/policy-engine/src/public-manifest.ts tests/permission-policy.test.mjs baseline only;  backlog:SEC-0092

  `SEC-0093`    P0         §299     `DEFERRED_VERIFICATION`   packages/policy-engine/src/public-manifest.ts tests/permission-policy.test.mjs baseline only;  backlog:SEC-0093

  `SEC-0094`    P0         §299     `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0094

  `SEC-0095`    P0         §299     `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0095

  `SEC-0096`    P0         §299     `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0096

  `SEC-0097`    P0         §299     `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0097

  `SEC-0098`    P1         §300     `DEFERRED_VERIFICATION`   packages/contracts/src/permission-policy.ts tests/permission-policy.test.mjs baseline only;  backlog:SEC-0098

  `CAP-0067`    P1         §301     `DEFERRED_VERIFICATION`   ---              ---        --- backlog:CAP-0067

  `CAP-0068`    P1         §301     `DEFERRED_VERIFICATION`   ---              ---        --- backlog:CAP-0068

  `CAP-0069`    P1         §301     `DEFERRED_VERIFICATION`   ---              ---        --- backlog:CAP-0069

  `CAP-0070`    P1         §301     `DEFERRED_VERIFICATION`   ---              ---        --- backlog:CAP-0070

  `SEC-0099`    P1         §302     `DEFERRED_VERIFICATION`   packages/policy-engine/src/public-manifest.ts tests/permission-policy.test.mjs baseline only;  backlog:SEC-0099

  `SEC-0100`    P0         §302     `DEFERRED_VERIFICATION`   packages/policy-engine/src/public-manifest.ts tests/permission-policy.test.mjs baseline only;  backlog:SEC-0100

  `SEC-0101`    P0         §302     `DEFERRED_VERIFICATION`   packages/policy-engine/src/public-manifest.ts tests/permission-policy.test.mjs baseline only;  backlog:SEC-0101

  `SEC-0102`    P1         §303     `DEFERRED_VERIFICATION`   packages/policy-engine/src/public-manifest.ts tests/permission-policy.test.mjs baseline only;  backlog:SEC-0102

  `SEC-0103`    P0         §303     `DEFERRED_VERIFICATION`   packages/policy-engine/src/public-manifest.ts tests/permission-policy.test.mjs baseline only;  backlog:SEC-0103

  `SEC-0104`    P0         §303     `DEFERRED_VERIFICATION`   packages/policy-engine/src/public-manifest.ts tests/permission-policy.test.mjs baseline only;  backlog:SEC-0104

  `SEC-0105`    P1         §304     `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0105

  `SEC-0106`    P0         §304     `DEFERRED_VERIFICATION`   ---              ---        --- backlog:SEC-0106

  `CAP-0071`    P1         §305     `DEFERRED_VERIFICATION`   packages/contracts/src/capability-version.ts tests/capability-version.test.mjs baseline only;  backlog:CAP-0071

  `CAP-0072`    P1         §305     `DEFERRED_VERIFICATION`   packages/contracts/src/capability-version.ts,packages/persistence/migrations/0001_foundation.sql tests/capability-version.test.mjs,tests/sql/m01_foundation.sql baseline only;  backlog:CAP-0072

  `CAP-0073`    P1         §306     `DEFERRED_VERIFICATION`   packages/contracts/src/capability-version.ts tests/capability-version.test.mjs baseline only;  backlog:CAP-0073

  `CAP-0074`    P1         §306     `DEFERRED_VERIFICATION`   packages/domain/src/capability-version.ts tests/capability-version.test.mjs baseline only;  backlog:CAP-0074

  `CAP-0075`    P1         §306     `DEFERRED_VERIFICATION`   packages/contracts/src/capability-version.ts tests/capability-version.test.mjs baseline only;  backlog:CAP-0075

  `CAP-0076`    P1         §307     `DEFERRED_VERIFICATION`   packages/persistence/migrations/0001_foundation.sql tests/sql/m01_foundation.sql baseline only;  backlog:CAP-0076

  `CAP-0077`    P1         §307     `DEFERRED_VERIFICATION`   packages/persistence/migrations/0001_foundation.sql tests/sql/m01_foundation.sql baseline only;  backlog:CAP-0077

  `CAP-0078`    P1         §307     `DEFERRED_VERIFICATION`   ---              ---        --- backlog:CAP-0078

  `CAP-0079`    P1         §308     `DEFERRED_VERIFICATION`   packages/contracts/src/capability-version.ts,packages/domain/src/capability-version.ts tests/capability-version.test.mjs baseline only;  backlog:CAP-0079

  `CAP-0080`    P1         §308     `DEFERRED_VERIFICATION`   packages/domain/src/capability-version.ts tests/capability-version.test.mjs baseline only;  backlog:CAP-0080

  `CAP-0081`    P1         §309     `TODO`   ---              ---        ---

  `CAP-0082`    P1         §309     `TODO`   ---              ---        ---

  `CAP-0083`    P1         §310     `TODO`   ---              ---        ---

  `SEC-0107`    P1         §311     `TODO`   ---              ---        ---

  `CAP-0084`    P1         §312     `TODO`   ---              ---        ---

  `CAP-0085`    P1         §312     `TODO`   ---              ---        ---

  `TST-0020`    P1         §313     `TODO`   ---              ---        ---

  `PRD-0316`    P1         §314     `TODO`   ---              ---        ---

  `PRD-0317`    P2         §314     `TODO`   ---              ---        ---

  `PRD-0318`    P1         §315     `TODO`   ---              ---        ---

  `PRD-0319`    P2         §315     `TODO`   ---              ---        ---

  `CAP-0086`    P1         §316     `TODO`   ---              ---        ---

  `JOB-0066`    P1         §317     `TODO`   ---              ---        ---

  `JOB-0067`    P1         §317     `TODO`   ---              ---        ---

  `PRD-0320`    P1         §318     `TODO`   ---              ---        ---

  `PRD-0321`    P2         §318     `TODO`   ---              ---        ---

  `PRD-0322`    P2         §318     `TODO`   ---              ---        ---

  `API-0008`    P1         §319     `TODO`   ---              ---        ---

  `API-0009`    P1         §319     `TODO`   ---              ---        ---

  `API-0010`    P1         §319     `TODO`   ---              ---        ---

  `API-0011`    P1         §319     `TODO`   ---              ---        ---

  `API-0012`    P1         §320     `TODO`   ---              ---        ---

  `API-0013`    P1         §320     `TODO`   ---              ---        ---

  `API-0014`    P1         §320     `TODO`   ---              ---        ---

  `API-0015`    P1         §321     `TODO`   ---              ---        ---

  `API-0016`    P1         §321     `TODO`   ---              ---        ---

  `IO-0136`     P1         §322     `TODO`   ---              ---        ---

  `IO-0137`     P1         §322     `TODO`   ---              ---        ---

  `CAP-0087`    P1         §323     `TODO`   ---              ---        ---

  `PAY-0102`    P1         §324     `TODO`   ---              ---        ---

  `PAY-0103`    P0         §324     `TODO`   ---              ---        ---

  `PAY-0104`    P0         §324     `TODO`   ---              ---        ---

  `PAY-0105`    P0         §324     `TODO`   ---              ---        ---

  `API-0017`    P1         §325     `TODO`   ---              ---        ---

  `API-0018`    P1         §325     `TODO`   ---              ---        ---

  `API-0019`    P1         §325     `TODO`   ---              ---        ---

  `API-0020`    P1         §326     `TODO`   ---              ---        ---

  `API-0021`    P1         §326     `TODO`   ---              ---        ---

  `PRD-0323`    P1         §327     `TODO`   ---              ---        ---

  `JOB-0068`    P1         §328     `TODO`   ---              ---        ---

  `JOB-0069`    P1         §328     `TODO`   ---              ---        ---

  `API-0022`    P1         §329     `TODO`   ---              ---        ---

  `JOB-0070`    P1         §330     `TODO`   ---              ---        ---

  `JOB-0071`    P1         §330     `TODO`   ---              ---        ---

  `PRD-0324`    P1         §331     `TODO`   ---              ---        ---

  `PRD-0325`    P2         §331     `TODO`   ---              ---        ---

  `PRD-0326`    P1         §332     `TODO`   ---              ---        ---

  `PRD-0327`    P2         §332     `TODO`   ---              ---        ---

  `PRD-0328`    P2         §332     `TODO`   ---              ---        ---

  `AVL-0003`    P1         §333     `TODO`   ---              ---        ---

  `API-0023`    P1         §334     `TODO`   ---              ---        ---

  `API-0024`    P1         §334     `TODO`   ---              ---        ---

  `API-0025`    P1         §334     `TODO`   ---              ---        ---

  `API-0026`    P1         §335     `TODO`   ---              ---        ---

  `API-0027`    P1         §335     `TODO`   ---              ---        ---

  `JOB-0072`    P1         §336     `TODO`   ---              ---        ---

  `JOB-0073`    P1         §336     `TODO`   ---              ---        ---

  `AVL-0004`    P1         §337     `TODO`   ---              ---        ---

  `AVL-0005`    P1         §337     `TODO`   ---              ---        ---

  `JOB-0074`    P1         §338     `TODO`   ---              ---        ---

  `JOB-0075`    P1         §338     `TODO`   ---              ---        ---

  `JOB-0076`    P1         §338     `TODO`   ---              ---        ---

  `JOB-0077`    P1         §339     `TODO`   ---              ---        ---

  `JOB-0078`    P1         §339     `TODO`   ---              ---        ---

  `JOB-0079`    P1         §339     `TODO`   ---              ---        ---

  `AVL-0006`    P1         §340     `TODO`   ---              ---        ---

  `AVL-0007`    P1         §340     `TODO`   ---              ---        ---

  `AVL-0008`    P1         §340     `TODO`   ---              ---        ---

  `AVL-0009`    P1         §340     `TODO`   ---              ---        ---

  `JOB-0080`    P1         §341     `TODO`   ---              ---        ---

  `JOB-0081`    P1         §341     `TODO`   ---              ---        ---

  `JOB-0082`    P1         §342     `TODO`   ---              ---        ---

  `PRD-0329`    P1         §343     `TODO`   ---              ---        ---

  `PRD-0330`    P2         §343     `TODO`   ---              ---        ---

  `JOB-0083`    P1         §344     `TODO`   ---              ---        ---

  `JOB-0084`    P1         §344     `TODO`   ---              ---        ---

  `PAY-0106`    P1         §345     `TODO`   ---              ---        ---

  `PAY-0107`    P0         §345     `TODO`   ---              ---        ---

  `PAY-0108`    P0         §345     `TODO`   ---              ---        ---

  `WRK-0099`    P1         §346     `TODO`   ---              ---        ---

  `WRK-0100`    P1         §346     `TODO`   ---              ---        ---

  `AVL-0010`    P1         §347     `TODO`   ---              ---        ---

  `AVL-0011`    P1         §347     `TODO`   ---              ---        ---

  `AVL-0012`    P1         §347     `TODO`   ---              ---        ---

  `AVL-0013`    P1         §347     `TODO`   ---              ---        ---

  `AVL-0014`    P1         §347     `TODO`   ---              ---        ---

  `AVL-0015`    P1         §348     `TODO`   ---              ---        ---

  `AVL-0016`    P1         §348     `TODO`   ---              ---        ---

  `UI-0024`     P1         §349     `TODO`   ---              ---        ---

  `UI-0025`     P2         §349     `TODO`   ---              ---        ---

  `AVL-0017`    P1         §350     `TODO`   ---              ---        ---

  `AVL-0018`    P1         §350     `TODO`   ---              ---        ---

  `CAP-0088`    P1         §351     `TODO`   ---              ---        ---

  `CAP-0089`    P1         §351     `TODO`   ---              ---        ---

  `JOB-0085`    P1         §352     `TODO`   ---              ---        ---

  `JOB-0086`    P1         §352     `TODO`   ---              ---        ---

  `JOB-0087`    P1         §353     `TODO`   ---              ---        ---

  `JOB-0088`    P1         §353     `TODO`   ---              ---        ---

  `JOB-0089`    P1         §353     `TODO`   ---              ---        ---

  `AVL-0019`    P1         §354     `TODO`   ---              ---        ---

  `AVL-0020`    P1         §354     `TODO`   ---              ---        ---

  `CAP-0090`    P1         §355     `TODO`   ---              ---        ---

  `CAP-0091`    P1         §355     `TODO`   ---              ---        ---

  `CAP-0092`    P1         §355     `TODO`   ---              ---        ---

  `CAP-0093`    P1         §355     `TODO`   ---              ---        ---

  `CAP-0094`    P1         §355     `TODO`   ---              ---        ---

  `PRD-0331`    P1         §356     `TODO`   ---              ---        ---

  `PRD-0332`    P2         §356     `TODO`   ---              ---        ---

  `CAP-0095`    P1         §357     `TODO`   ---              ---        ---

  `CAP-0096`    P1         §357     `TODO`   ---              ---        ---

  `CAP-0097`    P1         §357     `TODO`   ---              ---        ---

  `CAP-0098`    P1         §358     `TODO`   ---              ---        ---

  `CAP-0099`    P1         §358     `TODO`   ---              ---        ---

  `CAP-0100`    P1         §358     `TODO`   ---              ---        ---

  `CAP-0101`    P1         §359     `TODO`   ---              ---        ---

  `PRD-0333`    P1         §360     `TODO`   ---              ---        ---

  `PRD-0334`    P2         §360     `TODO`   ---              ---        ---

  `PRD-0335`    P2         §360     `TODO`   ---              ---        ---

  `IO-0138`     P1         §361     `TODO`   ---              ---        ---

  `IO-0139`     P1         §361     `TODO`   ---              ---        ---

  `CAP-0102`    P1         §362     `TODO`   ---              ---        ---

  `CAP-0103`    P1         §362     `TODO`   ---              ---        ---

  `CAP-0104`    P1         §362     `TODO`   ---              ---        ---

  `PRD-0336`    P1         §363     `TODO`   ---              ---        ---

  `PRD-0337`    P2         §363     `TODO`   ---              ---        ---

  `PRD-0338`    P2         §363     `TODO`   ---              ---        ---

  `PRD-0339`    P2         §363     `TODO`   ---              ---        ---

  `IO-0140`     P1         §364     `TODO`   ---              ---        ---

  `IO-0141`     P1         §364     `TODO`   ---              ---        ---

  `IO-0142`     P1         §364     `TODO`   ---              ---        ---

  `CAP-0105`    P1         §365     `TODO`   ---              ---        ---

  `CAP-0106`    P1         §365     `TODO`   ---              ---        ---

  `CAP-0107`    P1         §365     `TODO`   ---              ---        ---

  `CAP-0108`    P1         §365     `TODO`   ---              ---        ---

  `PRD-0340`    P1         §366     `TODO`   ---              ---        ---

  `PRD-0341`    P2         §366     `TODO`   ---              ---        ---

  `IO-0143`     P1         §367     `TODO`   ---              ---        ---

  `IO-0144`     P1         §367     `TODO`   ---              ---        ---

  `CAP-0109`    P1         §368     `TODO`   ---              ---        ---

  `OBS-0007`    P1         §369     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `OBS-0008`    P2         §369     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `OBS-0009`    P2         §369     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `OBS-0010`    P2         §369     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `WRK-0101`    P1         §370     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `WRK-0102`    P1         §370     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `CAP-0110`    P1         §371     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `CAP-0111`    P1         §371     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `CAP-0112`    P1         §371     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `CAP-0113`    P1         §371     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `WRK-0103`    P1         §372     `DEFERRED_VERIFICATION`   packages/openclaw-adapter/src/discovery.ts   tests/openclaw-discovery.test.mjs   OPEN; see backlog

  `SEC-0108`    P1         §373     `DEFERRED_VERIFICATION`   apps/worker/src/cli.ts   tests/worker-cli.test.mjs   OPEN; see backlog

  `SEC-0109`    P0         §373     `DEFERRED_VERIFICATION`   apps/worker/src/cli.ts   tests/worker-cli.test.mjs   OPEN; see backlog

  `SEC-0110`    P0         §373     `DEFERRED_VERIFICATION`   apps/worker/src/cli.ts   tests/worker-cli.test.mjs   OPEN; see backlog

  `WRK-0104`    P1         §374     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `WRK-0105`    P1         §374     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `JOB-0090`    P1         §375     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `JOB-0091`    P1         §375     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `JOB-0092`    P1         §375     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `JOB-0093`    P1         §375     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `OBS-0011`    P1         §376     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `SEC-0111`    P1         §377     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `SEC-0112`    P0         §377     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `SEC-0113`    P1         §378     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `SEC-0114`    P0         §378     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `SEC-0115`    P0         §378     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `WRK-0106`    P1         §379     `DEFERRED_VERIFICATION`   apps/worker/src/cli.ts   tests/worker-cli.test.mjs   OPEN; see backlog

  `WRK-0107`    P1         §379     `VERIFIED`   apps/worker/src/cli.ts   tests/worker-cli.test.mjs   JSON health option

  `WRK-0108`    P1         §380     `DEFERRED_VERIFICATION`   apps/worker/src/cli.ts   tests/worker-cli.test.mjs   OPEN; see backlog

  `WRK-0109`    P1         §381     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `WRK-0110`    P1         §381     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `WRK-0111`    P1         §381     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `JOB-0094`    P1         §382     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts; apps/worker/src/cli.ts   tests/worker-local-state.test.mjs; tests/worker-cli.test.mjs   OPEN; see backlog

  `JOB-0095`    P1         §382     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts; apps/worker/src/cli.ts   tests/worker-local-state.test.mjs; tests/worker-cli.test.mjs   OPEN; see backlog

  `JOB-0096`    P1         §383     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts   tests/worker-local-state.test.mjs   OPEN; see backlog

  `JOB-0097`    P1         §383     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts   tests/worker-local-state.test.mjs   OPEN; see backlog

  `JOB-0098`    P1         §384     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts   tests/worker-local-state.test.mjs   OPEN; see backlog

  `JOB-0099`    P1         §384     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts   tests/worker-local-state.test.mjs   OPEN; see backlog

  `JOB-0100`    P1         §384     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts   tests/worker-local-state.test.mjs   OPEN; see backlog

  `JOB-0101`    P1         §385     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `JOB-0102`    P1         §385     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `JOB-0103`    P1         §385     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `JOB-0104`    P1         §386     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `JOB-0105`    P1         §387     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts   tests/worker-local-state.test.mjs   OPEN; see backlog

  `JOB-0106`    P1         §388     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `JOB-0107`    P1         §388     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `JOB-0108`    P1         §388     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `JOB-0109`    P1         §388     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `JOB-0110`    P1         §389     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `JOB-0111`    P1         §389     `DEFERRED_VERIFICATION`   ---   ---   OPEN; see backlog

  `JOB-0112`    P1         §390     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts   tests/worker-local-state.test.mjs   OPEN; see backlog

  `JOB-0113`    P1         §391     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts   tests/worker-local-state.test.mjs   OPEN; see backlog

  `JOB-0114`    P1         §391     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts   tests/worker-local-state.test.mjs   OPEN; see backlog

  `PRD-0342`    P1         §392     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts   tests/worker-local-state.test.mjs   OPEN; see backlog

  `PRD-0343`    P2         §392     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts   tests/worker-local-state.test.mjs   OPEN; see backlog

  `PRD-0344`    P2         §392     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts   tests/worker-local-state.test.mjs   OPEN; see backlog

  `SEC-0116`    P1         §393     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts   tests/worker-local-state.test.mjs   OPEN; see backlog

  `SEC-0117`    P0         §393     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts   tests/worker-local-state.test.mjs   OPEN; see backlog

  `SEC-0118`    P0         §393     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts   tests/worker-local-state.test.mjs   OPEN; see backlog

  `JOB-0115`    P1         §394     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts   tests/worker-local-state.test.mjs   OPEN; see backlog

  `JOB-0116`    P1         §394     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts   tests/worker-local-state.test.mjs   OPEN; see backlog

  `JOB-0117`    P1         §394     `DEFERRED_VERIFICATION`   apps/worker/src/local-state.ts   tests/worker-local-state.test.mjs   OPEN; see backlog

  `PRD-0345`    P1         §395     `DEFERRED_VERIFICATION`   apps/worker/src/cli.ts   tests/worker-cli.test.mjs   OPEN; see backlog

  `PRD-0346`    P2         §395     `DEFERRED_VERIFICATION`   apps/worker/src/cli.ts   tests/worker-cli.test.mjs   OPEN; see backlog

  `PRD-0347`    P2         §395     `DEFERRED_VERIFICATION`   apps/worker/src/cli.ts   tests/worker-cli.test.mjs   OPEN; see backlog

  `PRD-0348`    P2         §395     `DEFERRED_VERIFICATION`   apps/worker/src/cli.ts   tests/worker-cli.test.mjs   OPEN; see backlog

  `PRD-0349`    P1         §396     `TODO`   ---              ---        ---

  `PRD-0350`    P2         §396     `TODO`   ---              ---        ---

  `AVL-0021`    P1         §397     `TODO`   ---              ---        ---

  `AVL-0022`    P1         §398     `TODO`   ---              ---        ---

  `AVL-0023`    P1         §398     `TODO`   ---              ---        ---

  `AVL-0024`    P1         §399     `TODO`   ---              ---        ---

  `AVL-0025`    P1         §399     `TODO`   ---              ---        ---

  `AVL-0026`    P1         §399     `TODO`   ---              ---        ---

  `UI-0026`     P1         §400     `TODO`   ---              ---        ---

  `UI-0027`     P2         §400     `TODO`   ---              ---        ---

  `AVL-0027`    P1         §401     `TODO`   ---              ---        ---

  `AVL-0028`    P1         §401     `TODO`   ---              ---        ---

  `AVL-0029`    P1         §402     `TODO`   ---              ---        ---

  `AVL-0030`    P1         §402     `TODO`   ---              ---        ---

  `AVL-0031`    P1         §402     `TODO`   ---              ---        ---

  `AVL-0032`    P1         §403     `TODO`   ---              ---        ---

  `AVL-0033`    P1         §404     `TODO`   ---              ---        ---

  `AVL-0034`    P1         §404     `TODO`   ---              ---        ---

  `AVL-0035`    P1         §405     `TODO`   ---              ---        ---

  `AVL-0036`    P1         §405     `TODO`   ---              ---        ---

  `AVL-0037`    P1         §406     `TODO`   ---              ---        ---

  `AVL-0038`    P1         §406     `TODO`   ---              ---        ---

  `JOB-0118`    P1         §407     `TODO`   ---              ---        ---

  `JOB-0119`    P1         §407     `TODO`   ---              ---        ---

  `JOB-0120`    P1         §408     `TODO`   ---              ---        ---

  `JOB-0121`    P1         §408     `TODO`   ---              ---        ---

  `JOB-0122`    P1         §408     `TODO`   ---              ---        ---

  `JOB-0123`    P1         §408     `TODO`   ---              ---        ---

  `JOB-0124`    P1         §408     `TODO`   ---              ---        ---

  `JOB-0125`    P1         §408     `TODO`   ---              ---        ---

  `JOB-0126`    P1         §409     `TODO`   ---              ---        ---

  `JOB-0127`    P1         §409     `TODO`   ---              ---        ---

  `JOB-0128`    P1         §409     `TODO`   ---              ---        ---

  `AVL-0039`    P1         §410     `TODO`   ---              ---        ---

  `AVL-0040`    P1         §410     `TODO`   ---              ---        ---

  `AVL-0041`    P1         §410     `TODO`   ---              ---        ---

  `JOB-0129`    P1         §411     `TODO`   ---              ---        ---

  `JOB-0130`    P1         §411     `TODO`   ---              ---        ---

  `JOB-0131`    P1         §412     `TODO`   ---              ---        ---

  `JOB-0132`    P1         §412     `TODO`   ---              ---        ---

  `AVL-0042`    P1         §413     `TODO`   ---              ---        ---

  `AVL-0043`    P1         §413     `TODO`   ---              ---        ---

  `AVL-0044`    P1         §413     `TODO`   ---              ---        ---

  `PRD-0351`    P1         §414     `TODO`   ---              ---        ---

  `PRD-0352`    P2         §414     `TODO`   ---              ---        ---

  `AVL-0045`    P1         §415     `TODO`   ---              ---        ---

  `AVL-0046`    P1         §415     `TODO`   ---              ---        ---

  `AVL-0047`    P1         §415     `TODO`   ---              ---        ---

  `PRD-0353`    P1         §416     `TODO`   ---              ---        ---

  `PRD-0354`    P2         §416     `TODO`   ---              ---        ---

  `PRD-0355`    P2         §416     `TODO`   ---              ---        ---

  `AVL-0048`    P1         §417     `TODO`   ---              ---        ---

  `AVL-0049`    P1         §418     `TODO`   ---              ---        ---

  `AVL-0050`    P1         §418     `TODO`   ---              ---        ---

  `PRD-0356`    P1         §419     `TODO`   ---              ---        ---

  `PRD-0357`    P2         §419     `TODO`   ---              ---        ---

  `PRD-0358`    P2         §419     `TODO`   ---              ---        ---

  `AVL-0051`    P1         §420     `TODO`   ---              ---        ---

  `AVL-0052`    P1         §420     `TODO`   ---              ---        ---

  `PRD-0359`    P1         §421     `TODO`   ---              ---        ---

  `JOB-0133`    P1         §422     `TODO`   ---              ---        ---

  `JOB-0134`    P1         §422     `TODO`   ---              ---        ---

  `AVL-0053`    P1         §423     `TODO`   ---              ---        ---

  `AVL-0054`    P1         §424     `TODO`   ---              ---        ---

  `AVL-0055`    P1         §424     `TODO`   ---              ---        ---

  `AVL-0056`    P1         §424     `TODO`   ---              ---        ---

  `AVL-0057`    P1         §424     `TODO`   ---              ---        ---

  `AVL-0058`    P1         §424     `TODO`   ---              ---        ---

  `PRD-0360`    P1         §425     `TODO`   ---              ---        ---

  `PRD-0361`    P2         §425     `TODO`   ---              ---        ---

  `PRD-0362`    P2         §425     `TODO`   ---              ---        ---

  `PRD-0363`    P2         §425     `TODO`   ---              ---        ---

  `PRD-0364`    P2         §425     `TODO`   ---              ---        ---

  `JOB-0135`    P1         §426     `TODO`   ---              ---        ---

  `JOB-0136`    P1         §426     `TODO`   ---              ---        ---

  `JOB-0137`    P1         §426     `TODO`   ---              ---        ---

  `JOB-0138`    P1         §427     `TODO`   ---              ---        ---

  `JOB-0139`    P1         §428     `TODO`   ---              ---        ---

  `JOB-0140`    P1         §428     `TODO`   ---              ---        ---

  `JOB-0141`    P1         §428     `TODO`   ---              ---        ---

  `JOB-0142`    P1         §428     `TODO`   ---              ---        ---

  `JOB-0143`    P1         §429     `TODO`   ---              ---        ---

  `JOB-0144`    P1         §429     `TODO`   ---              ---        ---

  `JOB-0145`    P1         §429     `TODO`   ---              ---        ---

  `JOB-0146`    P1         §430     `TODO`   ---              ---        ---

  `JOB-0147`    P1         §430     `TODO`   ---              ---        ---

  `JOB-0148`    P1         §430     `TODO`   ---              ---        ---

  `JOB-0149`    P1         §431     `TODO`   ---              ---        ---

  `JOB-0150`    P1         §431     `TODO`   ---              ---        ---

  `JOB-0151`    P1         §431     `TODO`   ---              ---        ---

  `JOB-0152`    P1         §431     `TODO`   ---              ---        ---

  `JOB-0153`    P1         §431     `TODO`   ---              ---        ---

  `JOB-0154`    P1         §431     `TODO`   ---              ---        ---

  `JOB-0155`    P1         §432     `TODO`   ---              ---        ---

  `JOB-0156`    P1         §432     `TODO`   ---              ---        ---

  `JOB-0157`    P1         §432     `TODO`   ---              ---        ---

  `JOB-0158`    P1         §432     `TODO`   ---              ---        ---

  `JOB-0159`    P1         §433     `TODO`   ---              ---        ---

  `JOB-0160`    P1         §433     `TODO`   ---              ---        ---

  `JOB-0161`    P1         §433     `TODO`   ---              ---        ---

  `JOB-0162`    P1         §433     `TODO`   ---              ---        ---

  `JOB-0163`    P1         §433     `TODO`   ---              ---        ---

  `JOB-0164`    P1         §434     `TODO`   ---              ---        ---

  `JOB-0165`    P1         §434     `TODO`   ---              ---        ---

  `JOB-0166`    P1         §434     `TODO`   ---              ---        ---

  `JOB-0167`    P1         §435     `TODO`   ---              ---        ---

  `JOB-0168`    P1         §435     `TODO`   ---              ---        ---

  `JOB-0169`    P1         §435     `TODO`   ---              ---        ---

  `JOB-0170`    P1         §435     `TODO`   ---              ---        ---

  `JOB-0171`    P1         §436     `TODO`   ---              ---        ---

  `JOB-0172`    P1         §436     `TODO`   ---              ---        ---

  `JOB-0173`    P1         §436     `TODO`   ---              ---        ---

  `PRD-0365`    P1         §437     `TODO`   ---              ---        ---

  `PRD-0366`    P2         §437     `TODO`   ---              ---        ---

  `PRD-0367`    P2         §437     `TODO`   ---              ---        ---

  `JOB-0174`    P1         §438     `TODO`   ---              ---        ---

  `JOB-0175`    P1         §438     `TODO`   ---              ---        ---

  `JOB-0176`    P1         §438     `TODO`   ---              ---        ---

  `JOB-0177`    P1         §439     `TODO`   ---              ---        ---

  `JOB-0178`    P1         §439     `TODO`   ---              ---        ---

  `JOB-0179`    P1         §440     `TODO`   ---              ---        ---

  `JOB-0180`    P1         §440     `TODO`   ---              ---        ---

  `JOB-0181`    P1         §441     `TODO`   ---              ---        ---

  `JOB-0182`    P1         §441     `TODO`   ---              ---        ---

  `JOB-0183`    P1         §441     `TODO`   ---              ---        ---

  `JOB-0184`    P1         §442     `TODO`   ---              ---        ---

  `JOB-0185`    P1         §442     `TODO`   ---              ---        ---

  `JOB-0186`    P1         §442     `TODO`   ---              ---        ---

  `JOB-0187`    P1         §443     `TODO`   ---              ---        ---

  `JOB-0188`    P1         §443     `TODO`   ---              ---        ---

  `JOB-0189`    P1         §443     `TODO`   ---              ---        ---

  `JOB-0190`    P1         §444     `TODO`   ---              ---        ---

  `JOB-0191`    P1         §444     `TODO`   ---              ---        ---

  `JOB-0192`    P1         §444     `TODO`   ---              ---        ---

  `JOB-0193`    P1         §444     `TODO`   ---              ---        ---

  `JOB-0194`    P1         §445     `TODO`   ---              ---        ---

  `JOB-0195`    P1         §445     `TODO`   ---              ---        ---

  `JOB-0196`    P1         §445     `TODO`   ---              ---        ---

  `JOB-0197`    P1         §446     `TODO`   ---              ---        ---

  `JOB-0198`    P1         §446     `TODO`   ---              ---        ---

  `JOB-0199`    P1         §447     `TODO`   ---              ---        ---

  `JOB-0200`    P1         §447     `TODO`   ---              ---        ---

  `JOB-0201`    P1         §447     `TODO`   ---              ---        ---

  `JOB-0202`    P1         §448     `TODO`   ---              ---        ---

  `JOB-0203`    P1         §449     `TODO`   ---              ---        ---

  `JOB-0204`    P1         §449     `TODO`   ---              ---        ---

  `JOB-0205`    P1         §449     `TODO`   ---              ---        ---

  `JOB-0206`    P1         §450     `TODO`   ---              ---        ---

  `JOB-0207`    P1         §450     `TODO`   ---              ---        ---

  `JOB-0208`    P1         §450     `TODO`   ---              ---        ---

  `JOB-0209`    P1         §450     `TODO`   ---              ---        ---

  `JOB-0210`    P1         §450     `TODO`   ---              ---        ---

  `AVL-0059`    P1         §451     `TODO`   ---              ---        ---

  `AVL-0060`    P1         §451     `TODO`   ---              ---        ---

  `AVL-0061`    P1         §451     `TODO`   ---              ---        ---

  `AVL-0062`    P1         §452     `TODO`   ---              ---        ---

  `AVL-0063`    P1         §452     `TODO`   ---              ---        ---

  `JOB-0211`    P1         §453     `TODO`   ---              ---        ---

  `JOB-0212`    P1         §453     `TODO`   ---              ---        ---

  `JOB-0213`    P1         §454     `TODO`   ---              ---        ---

  `JOB-0214`    P1         §454     `TODO`   ---              ---        ---

  `JOB-0215`    P1         §455     `TODO`   ---              ---        ---

  `JOB-0216`    P1         §455     `TODO`   ---              ---        ---

  `JOB-0217`    P1         §456     `TODO`   ---              ---        ---

  `JOB-0218`    P1         §457     `TODO`   ---              ---        ---

  `JOB-0219`    P1         §457     `TODO`   ---              ---        ---

  `JOB-0220`    P1         §458     `TODO`   ---              ---        ---

  `JOB-0221`    P1         §459     `TODO`   ---              ---        ---

  `JOB-0222`    P1         §459     `TODO`   ---              ---        ---

  `PAY-0109`    P1         §460     `TODO`   ---              ---        ---

  `PAY-0110`    P0         §460     `TODO`   ---              ---        ---

  `UI-0028`     P1         §461     `TODO`   ---              ---        ---

  `UI-0029`     P2         §461     `TODO`   ---              ---        ---

  `UI-0030`     P2         §461     `TODO`   ---              ---        ---

  `UI-0031`     P2         §461     `TODO`   ---              ---        ---

  `PRD-0368`    P1         §462     `TODO`   ---              ---        ---

  `PRD-0369`    P2         §462     `TODO`   ---              ---        ---

  `AVL-0064`    P1         §463     `TODO`   ---              ---        ---

  `AVL-0065`    P1         §463     `TODO`   ---              ---        ---

  `JOB-0223`    P1         §464     `TODO`   ---              ---        ---

  `JOB-0224`    P1         §464     `TODO`   ---              ---        ---

  `JOB-0225`    P1         §465     `TODO`   ---              ---        ---

  `JOB-0226`    P1         §466     `TODO`   ---              ---        ---

  `JOB-0227`    P1         §466     `TODO`   ---              ---        ---

  `PRD-0370`    P1         §467     `TODO`   ---              ---        ---

  `PRD-0371`    P2         §467     `TODO`   ---              ---        ---

  `PRD-0372`    P1         §468     `TODO`   ---              ---        ---

  `PRD-0373`    P2         §468     `TODO`   ---              ---        ---

  `AVL-0066`    P1         §469     `TODO`   ---              ---        ---

  `PRD-0374`    P1         §470     `TODO`   ---              ---        ---

  `PRD-0375`    P2         §470     `TODO`   ---              ---        ---

  `JOB-0228`    P1         §471     `TODO`   ---              ---        ---

  `JOB-0229`    P1         §471     `TODO`   ---              ---        ---

  `JOB-0230`    P1         §471     `TODO`   ---              ---        ---

  `AVL-0067`    P1         §472     `TODO`   ---              ---        ---

  `AVL-0068`    P1         §472     `TODO`   ---              ---        ---

  `AVL-0069`    P1         §472     `TODO`   ---              ---        ---

  `JOB-0231`    P1         §473     `TODO`   ---              ---        ---

  `CAP-0114`    P1         §474     `TODO`   ---              ---        ---

  `AVL-0070`    P1         §475     `TODO`   ---              ---        ---

  `AVL-0071`    P1         §475     `TODO`   ---              ---        ---

  `PRD-0376`    P1         §476     `TODO`   ---              ---        ---

  `AVL-0072`    P1         §477     `TODO`   ---              ---        ---

  `AVL-0073`    P1         §478     `TODO`   ---              ---        ---

  `PRD-0377`    P1         §479     `TODO`   ---              ---        ---

  `PRD-0378`    P2         §479     `TODO`   ---              ---        ---

  `AGT-0098`    P1         §480     `TODO`   ---              ---        ---

  `AGT-0099`    P1         §480     `TODO`   ---              ---        ---

  `AGT-0100`    P1         §480     `TODO`   ---              ---        ---

  `AGT-0101`    P1         §480     `TODO`   ---              ---        ---

  `JOB-0232`    P1         §481     `TODO`   ---              ---        ---

  `JOB-0233`    P1         §481     `TODO`   ---              ---        ---

  `JOB-0234`    P1         §481     `TODO`   ---              ---        ---

  `JOB-0235`    P1         §482     `TODO`   ---              ---        ---

  `JOB-0236`    P1         §483     `TODO`   ---              ---        ---

  `JOB-0237`    P1         §483     `TODO`   ---              ---        ---

  `JOB-0238`    P1         §483     `TODO`   ---              ---        ---

  `JOB-0239`    P1         §483     `TODO`   ---              ---        ---

  `PRD-0379`    P1         §484     `TODO`   ---              ---        ---

  `PRD-0380`    P2         §484     `TODO`   ---              ---        ---

  `PRD-0381`    P2         §484     `TODO`   ---              ---        ---

  `JOB-0240`    P1         §485     `TODO`   ---              ---        ---

  `JOB-0241`    P1         §486     `TODO`   ---              ---        ---

  `JOB-0242`    P1         §486     `TODO`   ---              ---        ---

  `JOB-0243`    P1         §486     `TODO`   ---              ---        ---

  `PRD-0382`    P1         §487     `TODO`   ---              ---        ---

  `PRD-0383`    P2         §487     `TODO`   ---              ---        ---

  `AVL-0074`    P1         §488     `TODO`   ---              ---        ---

  `AVL-0075`    P1         §488     `TODO`   ---              ---        ---

  `AVL-0076`    P1         §488     `TODO`   ---              ---        ---

  `PRD-0384`    P1         §489     `TODO`   ---              ---        ---

  `PRD-0385`    P2         §489     `TODO`   ---              ---        ---

  `PRD-0386`    P2         §489     `TODO`   ---              ---        ---

  `PRD-0387`    P2         §489     `TODO`   ---              ---        ---

  `PRD-0388`    P1         §490     `TODO`   ---              ---        ---

  `PRD-0389`    P2         §490     `TODO`   ---              ---        ---

  `PRD-0390`    P2         §490     `TODO`   ---              ---        ---

  `PRD-0391`    P2         §490     `TODO`   ---              ---        ---

  `CAP-0115`    P1         §491     `TODO`   ---              ---        ---

  `CAP-0116`    P1         §491     `TODO`   ---              ---        ---

  `CAP-0117`    P1         §491     `TODO`   ---              ---        ---

  `CAP-0118`    P1         §491     `TODO`   ---              ---        ---

  `AVL-0077`    P1         §492     `TODO`   ---              ---        ---

  `AVL-0078`    P1         §492     `TODO`   ---              ---        ---

  `JOB-0244`    P1         §493     `TODO`   ---              ---        ---

  `JOB-0245`    P1         §493     `TODO`   ---              ---        ---

  `JOB-0246`    P1         §493     `TODO`   ---              ---        ---

  `PRD-0392`    P1         §494     `TODO`   ---              ---        ---

  `PRD-0393`    P2         §494     `TODO`   ---              ---        ---

  `AVL-0079`    P1         §495     `TODO`   ---              ---        ---

  `AVL-0080`    P1         §495     `TODO`   ---              ---        ---

  `AVL-0081`    P1         §495     `TODO`   ---              ---        ---

  `AVL-0082`    P1         §496     `TODO`   ---              ---        ---

  `AVL-0083`    P1         §496     `TODO`   ---              ---        ---

  `JOB-0247`    P1         §497     `TODO`   ---              ---        ---

  `JOB-0248`    P1         §497     `TODO`   ---              ---        ---

  `UI-0032`     P1         §498     `TODO`   ---              ---        ---

  `UI-0033`     P2         §498     `TODO`   ---              ---        ---

  `UI-0034`     P2         §498     `TODO`   ---              ---        ---

  `UI-0035`     P2         §498     `TODO`   ---              ---        ---

  `UI-0036`     P1         §499     `TODO`   ---              ---        ---

  `UI-0037`     P2         §499     `TODO`   ---              ---        ---

  `UI-0038`     P2         §499     `TODO`   ---              ---        ---

  `UI-0039`     P2         §499     `TODO`   ---              ---        ---

  `AVL-0084`    P1         §500     `TODO`   ---              ---        ---

  `AVL-0085`    P1         §500     `TODO`   ---              ---        ---

  `AVL-0086`    P1         §500     `TODO`   ---              ---        ---

  `PRD-0394`    P1         §501     `TODO`   ---              ---        ---

  `PRD-0395`    P2         §501     `TODO`   ---              ---        ---

  `AVL-0087`    P1         §502     `TODO`   ---              ---        ---

  `AVL-0088`    P1         §502     `TODO`   ---              ---        ---

  `AVL-0089`    P1         §502     `TODO`   ---              ---        ---

  `AVL-0090`    P1         §503     `TODO`   ---              ---        ---

  `AVL-0091`    P1         §503     `TODO`   ---              ---        ---

  `AVL-0092`    P1         §503     `TODO`   ---              ---        ---

  `AVL-0093`    P1         §504     `TODO`   ---              ---        ---

  `AVL-0094`    P1         §504     `TODO`   ---              ---        ---

  `AVL-0095`    P1         §504     `TODO`   ---              ---        ---

  `AVL-0096`    P1         §504     `TODO`   ---              ---        ---

  `PRD-0396`    P1         §505     `TODO`   ---              ---        ---

  `PRD-0397`    P2         §505     `TODO`   ---              ---        ---

  `PRD-0398`    P2         §505     `TODO`   ---              ---        ---

  `JOB-0249`    P1         §506     `TODO`   ---              ---        ---

  `JOB-0250`    P1         §506     `TODO`   ---              ---        ---

  `JOB-0251`    P1         §506     `TODO`   ---              ---        ---

  `TST-0021`    P1         §507     `TODO`   ---              ---        ---

  `AVL-0097`    P1         §508     `TODO`   ---              ---        ---

  `AVL-0098`    P1         §508     `TODO`   ---              ---        ---

  `CAP-0119`    P1         §509     `TODO`   ---              ---        ---

  `CAP-0120`    P1         §509     `TODO`   ---              ---        ---

  `AVL-0099`    P1         §510     `TODO`   ---              ---        ---

  `AVL-0100`    P1         §510     `TODO`   ---              ---        ---

  `AVL-0101`    P1         §510     `TODO`   ---              ---        ---

  `AVL-0102`    P1         §510     `TODO`   ---              ---        ---

  `PRD-0399`    P1         §511     `TODO`   ---              ---        ---

  `PRD-0400`    P2         §511     `TODO`   ---              ---        ---

  `AGT-0102`    P1         §512     `TODO`   ---              ---        ---

  `AGT-0103`    P1         §512     `TODO`   ---              ---        ---

  `PRD-0401`    P1         §513     `TODO`   ---              ---        ---

  `PRD-0402`    P2         §513     `TODO`   ---              ---        ---

  `PRD-0403`    P1         §514     `TODO`   ---              ---        ---

  `PRD-0404`    P2         §514     `TODO`   ---              ---        ---

  `JOB-0252`    P1         §515     `TODO`   ---              ---        ---

  `JOB-0253`    P1         §515     `TODO`   ---              ---        ---

  `JOB-0254`    P1         §515     `TODO`   ---              ---        ---

  `AVL-0103`    P1         §516     `TODO`   ---              ---        ---

  `AVL-0104`    P1         §516     `TODO`   ---              ---        ---

  `AVL-0105`    P1         §516     `TODO`   ---              ---        ---

  `AVL-0106`    P1         §516     `TODO`   ---              ---        ---

  `AVL-0107`    P1         §516     `TODO`   ---              ---        ---

  `AVL-0108`    P1         §516     `TODO`   ---              ---        ---

  `AVL-0109`    P1         §516     `TODO`   ---              ---        ---

  `PRD-0405`    P1         §517     `TODO`   ---              ---        ---

  `PRD-0406`    P2         §517     `TODO`   ---              ---        ---

  `PRD-0407`    P2         §517     `TODO`   ---              ---        ---

  `UI-0040`     P1         §518     `TODO`   ---              ---        ---

  `UI-0041`     P2         §518     `TODO`   ---              ---        ---

  `UI-0042`     P2         §518     `TODO`   ---              ---        ---

  `UI-0043`     P2         §518     `TODO`   ---              ---        ---

  `UI-0044`     P1         §519     `TODO`   ---              ---        ---

  `UI-0045`     P2         §519     `TODO`   ---              ---        ---

  `UI-0046`     P2         §519     `TODO`   ---              ---        ---

  `UI-0047`     P2         §519     `TODO`   ---              ---        ---

  `UI-0048`     P2         §519     `TODO`   ---              ---        ---

  `UI-0049`     P1         §520     `TODO`   ---              ---        ---

  `UI-0050`     P2         §520     `TODO`   ---              ---        ---

  `UI-0051`     P2         §520     `TODO`   ---              ---        ---

  `UI-0052`     P2         §520     `TODO`   ---              ---        ---

  `UI-0053`     P2         §520     `TODO`   ---              ---        ---

  `UI-0054`     P1         §521     `TODO`   ---              ---        ---

  `UI-0055`     P2         §521     `TODO`   ---              ---        ---

  `UI-0056`     P2         §521     `TODO`   ---              ---        ---

  `UI-0057`     P2         §521     `TODO`   ---              ---        ---

  `UI-0058`     P1         §522     `TODO`   ---              ---        ---

  `UI-0059`     P2         §522     `TODO`   ---              ---        ---

  `UI-0060`     P2         §522     `TODO`   ---              ---        ---

  `UI-0061`     P2         §522     `TODO`   ---              ---        ---

  `UI-0062`     P2         §522     `TODO`   ---              ---        ---

  `UI-0063`     P1         §523     `TODO`   ---              ---        ---

  `UI-0064`     P2         §523     `TODO`   ---              ---        ---

  `UI-0065`     P2         §523     `TODO`   ---              ---        ---

  `UI-0066`     P2         §523     `TODO`   ---              ---        ---

  `UI-0067`     P2         §523     `TODO`   ---              ---        ---

  `UI-0068`     P1         §524     `TODO`   ---              ---        ---

  `UI-0069`     P2         §524     `TODO`   ---              ---        ---

  `UI-0070`     P1         §525     `TODO`   ---              ---        ---

  `UI-0071`     P2         §525     `TODO`   ---              ---        ---

  `UI-0072`     P2         §525     `TODO`   ---              ---        ---

  `JOB-0255`    P1         §526     `TODO`   ---              ---        ---

  `JOB-0256`    P1         §526     `TODO`   ---              ---        ---

  `JOB-0257`    P1         §526     `TODO`   ---              ---        ---

  `JOB-0258`    P1         §526     `TODO`   ---              ---        ---

  `UI-0073`     P1         §527     `TODO`   ---              ---        ---

  `UI-0074`     P2         §527     `TODO`   ---              ---        ---

  `PRD-0408`    P1         §528     `TODO`   ---              ---        ---

  `PRD-0409`    P2         §528     `TODO`   ---              ---        ---

  `PRD-0410`    P2         §528     `TODO`   ---              ---        ---

  `PRD-0411`    P1         §529     `TODO`   ---              ---        ---

  `PRD-0412`    P2         §529     `TODO`   ---              ---        ---

  `PRD-0413`    P2         §529     `TODO`   ---              ---        ---

  `PRD-0414`    P2         §529     `TODO`   ---              ---        ---

  `AGT-0104`    P1         §530     `TODO`   ---              ---        ---

  `AGT-0105`    P1         §530     `TODO`   ---              ---        ---

  `AGT-0106`    P1         §530     `TODO`   ---              ---        ---

  `JOB-0259`    P1         §531     `TODO`   ---              ---        ---

  `JOB-0260`    P1         §531     `TODO`   ---              ---        ---

  `JOB-0261`    P1         §531     `TODO`   ---              ---        ---

  `SEC-0119`    P1         §532     `TODO`   ---              ---        ---

  `SEC-0120`    P0         §532     `TODO`   ---              ---        ---

  `SEC-0121`    P0         §532     `TODO`   ---              ---        ---

  `UI-0075`     P1         §533     `TODO`   ---              ---        ---

  `UI-0076`     P2         §533     `TODO`   ---              ---        ---

  `CAP-0121`    P1         §534     `TODO`   ---              ---        ---

  `CAP-0122`    P1         §534     `TODO`   ---              ---        ---

  `CAP-0123`    P1         §534     `TODO`   ---              ---        ---

  `PRD-0415`    P1         §535     `TODO`   ---              ---        ---

  `PRD-0416`    P2         §535     `TODO`   ---              ---        ---

  `PRD-0417`    P2         §535     `TODO`   ---              ---        ---

  `PRD-0418`    P2         §535     `TODO`   ---              ---        ---

  `JOB-0262`    P1         §536     `TODO`   ---              ---        ---

  `JOB-0263`    P1         §536     `TODO`   ---              ---        ---

  `JOB-0264`    P1         §536     `TODO`   ---              ---        ---

  `JOB-0265`    P1         §537     `TODO`   ---              ---        ---

  `JOB-0266`    P1         §537     `TODO`   ---              ---        ---

  `PRD-0419`    P1         §538     `TODO`   ---              ---        ---

  `PRD-0420`    P2         §538     `TODO`   ---              ---        ---

  `PRD-0421`    P2         §538     `TODO`   ---              ---        ---

  `PRD-0422`    P2         §538     `TODO`   ---              ---        ---

  `UI-0077`     P1         §539     `TODO`   ---              ---        ---

  `PAY-0111`    P1         §540     `TODO`   ---              ---        ---

  `PAY-0112`    P0         §540     `TODO`   ---              ---        ---

  `UI-0078`     P1         §541     `TODO`   ---              ---        ---

  `UI-0079`     P2         §541     `TODO`   ---              ---        ---

  `API-0028`    P1         §542     `TODO`   ---              ---        ---

  `API-0029`    P1         §542     `TODO`   ---              ---        ---

  `UI-0080`     P1         §543     `TODO`   ---              ---        ---

  `UI-0081`     P2         §543     `TODO`   ---              ---        ---

  `PRD-0423`    P1         §544     `TODO`   ---              ---        ---

  `UI-0082`     P1         §545     `TODO`   ---              ---        ---

  `UI-0083`     P2         §545     `TODO`   ---              ---        ---

  `UI-0084`     P1         §546     `TODO`   ---              ---        ---

  `UI-0085`     P2         §546     `TODO`   ---              ---        ---

  `UI-0086`     P2         §546     `TODO`   ---              ---        ---

  `UI-0087`     P1         §547     `TODO`   ---              ---        ---

  `UI-0088`     P2         §547     `TODO`   ---              ---        ---

  `UI-0089`     P1         §548     `TODO`   ---              ---        ---

  `UI-0090`     P2         §548     `TODO`   ---              ---        ---

  `PRD-0424`    P1         §549     `TODO`   ---              ---        ---

  `UI-0091`     P1         §550     `TODO`   ---              ---        ---

  `UI-0092`     P2         §550     `TODO`   ---              ---        ---

  `UI-0093`     P2         §550     `TODO`   ---              ---        ---
  --------------------------------------------------------------------------------

## Local development environment

  Requirement     Priority   Status   Implementation   Tests   Notes
  --------------- ---------- -------- ---------------- ------- -------
  DEV-LOCAL-001   P1         TODO     ---              ---     §551
  DEV-LOCAL-002   P1         TODO     ---              ---     §552
  DEV-LOCAL-003   P1         TODO     ---              ---     §553
  DEV-LOCAL-004   P1         TODO     ---              ---     §555
  DEV-LOCAL-005   P1         TODO     ---              ---     §556
  DEV-LOCAL-006   P1         TODO     ---              ---     §557
  DEV-LOCAL-007   P0         TODO     ---              ---     §558
  DEV-LOCAL-008   P0         TODO     ---              ---     §558
  DEV-LOCAL-009   P1         TODO     ---              ---     §559
  DEV-LOCAL-010   P1         TODO     ---              ---     §560
  DEV-LOCAL-011   P1         TODO     ---              ---     §561
  DEV-LOCAL-012   P0         TODO     ---              ---     §561
  DEV-LOCAL-013   P1         TODO     ---              ---     §562
  DEV-LOCAL-014   P1         TODO     ---              ---     §563
  DEV-LOCAL-015   P1         TODO     ---              ---     §564
  DEV-LOCAL-016   P0         TODO     ---              ---     §564
  DEV-LOCAL-017   P1         TODO     ---              ---     §565
  DEV-LOCAL-018   P1         TODO     ---              ---     §566
  DEV-LOCAL-019   P0         TODO     ---              ---     §566
  DEV-LOCAL-020   P1         TODO     ---              ---     §567
  DEV-LOCAL-021   P2         TODO     ---              ---     §568
  DEV-LOCAL-022   P1         TODO     ---              ---     §569
  DEV-LOCAL-023   P1         TODO     ---              ---     §570
  DEV-LOCAL-024   P1         TODO     ---              ---     §570
  DEV-LOCAL-025   P1         TODO     ---              ---     §571
  DEV-LOCAL-026   P1         TODO     ---              ---     §571
  DEV-LOCAL-027   P0         TODO     ---              ---     §572
  DEV-LOCAL-028   P0         TODO     ---              ---     §572
  DEV-LOCAL-029   P1         TODO     ---              ---     §573

## Authentication

  Requirement   Priority   Status   Implementation   Tests   Notes
  ------------- ---------- -------- ---------------- ------- -------
  AUTH-001      P1         TODO     ---              ---     §574
  AUTH-002      P1         IN_PROGRESS   packages/domain/src/identity-linking.ts   tests/identity-linking.test.mjs   §574 Single-account model/linking decision; no auth flows
  AUTH-003      P0         IN_PROGRESS   packages/domain/src/account.ts   tests/account.test.mjs   §575 Account gate only; API enforcement absent
  AUTH-004      P0         TODO     ---              ---     §575
  AUTH-005      P0         TODO     ---              ---     §575
  AUTH-006      P1         TODO     ---              ---     §575
  AUTH-007      P0         TODO     ---              ---     §575
  AUTH-008      P1         TODO     ---              ---     §576
  AUTH-009      P0         TODO     ---              ---     §576
  AUTH-010      P0         IN_PROGRESS   packages/domain/src/identity-linking.ts   tests/identity-linking.test.mjs   §576 Verified-claim policy; OIDC token validation absent
  AUTH-011      P0         IN_PROGRESS   packages/domain/src/identity-linking.ts   tests/identity-linking.test.mjs   §577 Same-email linking decision; DB transaction absent
  AUTH-012      P0         IN_PROGRESS   packages/domain/src/identity-linking.ts   tests/identity-linking.test.mjs   §577 Unverified claim denied; full takeover testing absent
  AUTH-013      P1         TODO     ---              ---     §577
  AUTH-014      P2         TODO     ---              ---     §577
  AUTH-015      P1         TODO     ---              ---     §578
  AUTH-016      P1         TODO     ---              ---     §578
  AUTH-017      P0         TODO     ---              ---     §579
  AUTH-018      P0         TODO     ---              ---     §579
  AUTH-019      P1         TODO     ---              ---     §579
  AUTH-020      P1         TODO     ---              ---     §579
  AUTH-021      P0         TODO     ---              ---     §579
  AUTH-022      P1         TODO     ---              ---     §580
  AUTH-023      P1         TODO     ---              ---     §580
  AUTH-024      P1         TODO     ---              ---     §580

## Netsons production profile

  Requirement    Priority   Status   Implementation   Tests   Notes
  -------------- ---------- -------- ---------------- ------- -------
  HOST-NET-001   P0         TODO     ---              ---     §581
  HOST-NET-002   P0         TODO     ---              ---     §582
  HOST-NET-003   P1         TODO     ---              ---     §583
  HOST-NET-004   P1         TODO     ---              ---     §583
  HOST-NET-005   P1         TODO     ---              ---     §584
  HOST-NET-006   P0         TODO     ---              ---     §585
  HOST-NET-007   P1         TODO     ---              ---     §585
  HOST-NET-008   P0         TODO     ---              ---     §586
  HOST-NET-009   P0         TODO     ---              ---     §587
  HOST-NET-010   P0         TODO     ---              ---     §588
  HOST-NET-011   P0         TODO     ---              ---     §589
  HOST-NET-012   P0         TODO     ---              ---     §589
  HOST-NET-013   P1         TODO     ---              ---     §590
  HOST-NET-014   P0         TODO     ---              ---     §591
  HOST-NET-015   P1         TODO     ---              ---     §592
  HOST-NET-016   P1         TODO     ---              ---     §593
  HOST-NET-017   P1         TODO     ---              ---     §594
  HOST-NET-018   P0         TODO     ---              ---     §595
  HOST-NET-019   P0         TODO     ---              ---     §596
  HOST-NET-020   P1         TODO     ---              ---     §597
  HOST-NET-021   P1         TODO     ---              ---     §598
  HOST-NET-022   P1         TODO     ---              ---     §598
  HOST-NET-023   P1         TODO     ---              ---     §599
  HOST-NET-024   P0         TODO     ---              ---     §600
  HOST-NET-025   P0         TODO     ---              ---     §601
  HOST-NET-026   P1         TODO     ---              ---     §602
  HOST-NET-027   P1         TODO     ---              ---     §603
  HOST-NET-028   P1         TODO     ---              ---     §604
  HOST-NET-029   P0         TODO     ---              ---     §605
  HOST-NET-030   P0         TODO     ---              ---     §606
  HOST-NET-031   P0         TODO     ---              ---     §607

## Backend portability and multi-control-plane continuity

  Requirement   Priority   Status   Implementation   Tests
  ------------- ---------- -------- ---------------- -------
  PORT-001      P0         TODO     ---              ---
  PORT-002      P0         TODO     ---              ---
  PORT-003      P0         TODO     ---              ---
  PORT-004      P0         TODO     ---              ---
  PORT-005      P0         TODO     ---              ---
  PORT-006      P0         TODO     ---              ---
  PORT-007      P0         TODO     ---              ---
  PORT-008      P0         TODO     ---              ---
  PORT-009      P0         TODO     ---              ---
  PORT-010      P0         TODO     ---              ---
  PORT-011      P1         TODO     ---              ---
  PORT-012      P0         TODO     ---              ---
  PORT-013      P0         TODO     ---              ---
  PORT-014      P1         TODO     ---              ---
  PORT-015      P0         TODO     ---              ---
  PORT-016      P0         TODO     ---              ---
  PORT-017      P1         TODO     ---              ---
  PORT-018      P0         TODO     ---              ---

## Transport-independent Worker connectivity

  Requirement   Priority   Status   Implementation   Tests
  ------------- ---------- -------- ---------------- -------
  PORT-019      P0         TODO     ---              ---
  PORT-020      P0         TODO     ---              ---
  PORT-021      P0         TODO     ---              ---
  PORT-022      P0         TODO     ---              ---
  PORT-023      P0         TODO     ---              ---
  PORT-024      P0         TODO     ---              ---
  PORT-025      P0         TODO     ---              ---
  PORT-026      P0         TODO     ---              ---
  PORT-027      P1         TODO     ---              ---
  PORT-028      P0         TODO     ---              ---
  PORT-029      P0         TODO     ---              ---
  PORT-030      P1         TODO     ---              ---

## Unified monorepo / dual deployment profile coverage

  -----------------------------------------------------------------------
  Requirement    Priority    Status      Implementation   Test evidence
                                         evidence         
  -------------- ----------- ----------- ---------------- ---------------
  ARCH-UNI-001   P0          IN_PROGRESS packages/        tests/architecture.test.mjs

  ARCH-UNI-002   P0          IN_PROGRESS apps/cloud-*/    tests/architecture.test.mjs

  ARCH-UNI-003   P0          TODO        ---              ---

  ARCH-UNI-004   P0          IN_PROGRESS tools/architecture.mjs tests/architecture.test.mjs

  ARCH-UNI-005   P0          IN_PROGRESS packages/infrastructure/contracts/src/ports.ts --- no adapters yet

  ARCH-UNI-006   P0          IN_PROGRESS apps/cloud-*/,packages/infrastructure/ tests/architecture.test.mjs profiles not runnable

  ARCH-UNI-007   P0          TODO        ---              ---

  ARCH-UNI-008   P0          TODO        ---              ---

  ARCH-UNI-009   P0          TODO        ---              ---

  ARCH-UNI-010   P0          TODO        ---              ---

  ARCH-UNI-011   P0          TODO        ---              ---

  ARCH-UNI-012   P0          TODO        ---              ---

  ARCH-UNI-013   P0          TODO        ---              ---

  ARCH-UNI-014   P0          TODO        ---              ---

  ARCH-UNI-015   P0          IN_PROGRESS tools/architecture.mjs tests/architecture.test.mjs local gate only

  ARCH-UNI-016   P1          TODO        ---              ---

  ARCH-UNI-017   P0          TODO        ---              ---

  ARCH-UNI-018   P0          TODO        ---              ---

  ARCH-UNI-019   P0          TODO        ---              ---

  ARCH-UNI-020   P0          TODO        ---              ---

  ARCH-UNI-021   P0          TODO        ---              ---

  ARCH-UNI-022   P0          TODO        ---              ---

  ARCH-UNI-023   P0          TODO        ---              ---

  ARCH-UNI-024   P0          TODO        ---              ---
  -----------------------------------------------------------------------

## Engineering hardening coverage

  ------------------------------------------------------------------------
  Requirement   Priority     Status       Implementation   Test evidence
                                          evidence         
  ------------- ------------ ------------ ---------------- ---------------
  HARD-001      P0           TODO         ---              ---

  HARD-002      P0           TODO         ---              ---

  HARD-003      P0           TODO         ---              ---

  HARD-004      P0           TODO         ---              ---

  HARD-005      P0           TODO         ---              ---

  HARD-006      P0           TODO         ---              ---

  HARD-007      P0           TODO         ---              ---

  HARD-008      P0           TODO         ---              ---

  HARD-009      P0           TODO         ---              ---

  HARD-010      P0           TODO         ---              ---

  HARD-011      P0           TODO         ---              ---

  HARD-012      P1           TODO         ---              ---

  HARD-013      P0           TODO         ---              ---

  HARD-014      P0           TODO         ---              ---

  HARD-015      P0           TODO         ---              ---

  HARD-016      P0           TODO         ---              ---

  HARD-017      P0           TODO         ---              ---

  HARD-018      P0           TODO         ---              ---

  HARD-019      P1           TODO         ---              ---

  HARD-020      P1           TODO         ---              ---

  HARD-021      P0           TODO         ---              ---

  HARD-022      P0           TODO         ---              ---

  HARD-023      P0           TODO         ---              ---

  HARD-024      P0           TODO         ---              ---

  HARD-025      P0           TODO         ---              ---

  HARD-026      P0           TODO         ---              ---

  HARD-027      P0           TODO         ---              ---

  HARD-028      P1           TODO         ---              ---
  ------------------------------------------------------------------------

## Durable asynchronous job/result coverage

  -----------------------------------------------------------------------------
  Requirement   Priority   Status   Shared     Netsons    AWS        Test
                                    evidence   evidence   evidence   evidence
  ------------- ---------- -------- ---------- ---------- ---------- ----------
  ASYNC-001     P0         TODO     ---        ---        ---        ---

  ASYNC-002     P0         TODO     ---        ---        ---        ---

  ASYNC-003     P0         TODO     ---        ---        ---        ---

  ASYNC-004     P0         TODO     ---        ---        ---        ---

  ASYNC-005     P0         TODO     ---        ---        ---        ---

  ASYNC-006     P0         TODO     ---        ---        ---        ---

  ASYNC-007     P0         TODO     ---        ---        ---        ---

  ASYNC-008     P0         TODO     ---        ---        ---        ---

  ASYNC-009     P0         TODO     ---        ---        ---        ---

  ASYNC-010     P0         TODO     ---        ---        ---        ---

  ASYNC-011     P0         TODO     ---        ---        ---        ---

  ASYNC-012     P0         TODO     ---        ---        ---        ---

  ASYNC-013     P0         TODO     ---        ---        ---        ---

  ASYNC-014     P0         TODO     ---        ---        ---        ---

  ASYNC-015     P0         TODO     ---        ---        ---        ---

  ASYNC-016     P0         TODO     ---        ---        ---        ---

  ASYNC-017     P0         TODO     ---        ---        ---        ---

  ASYNC-018     P1         TODO     ---        ---        ---        ---

  ASYNC-019     P0         TODO     ---        ---        ---        ---

  ASYNC-020     P1         TODO     ---        ---        ---        ---

  ASYNC-021     P0         TODO     ---        ---        ---        ---

  ASYNC-022     P0         TODO     ---        ---        ---        ---

  ASYNC-023     P0         TODO     ---        ---        ---        ---

  ASYNC-024     P0         TODO     ---        ---        ---        ---

  ASYNC-025     P0         TODO     ---        ---        ---        ---

  ASYNC-026     P0         TODO     ---        ---        ---        ---

  ASYNC-027     P0         TODO     ---        ---        ---        ---

  ASYNC-028     P0         TODO     ---        ---        ---        ---

  ASYNC-029     P0         TODO     ---        ---        ---        ---

  ASYNC-030     P0         TODO     ---        ---        ---        ---
  -----------------------------------------------------------------------------

## Buyer experience coverage

  ------------------------------------------------------------------------------
  Requirement   Priority   Status    Shared     Netsons    AWS        UX/E2E
                                     evidence   evidence   evidence   evidence
  ------------- ---------- --------- ---------- ---------- ---------- ----------
  BUYERUX-001   P0         TODO      ---        ---        ---        ---

  BUYERUX-002   P0         TODO      ---        ---        ---        ---

  BUYERUX-003   P0         TODO      ---        ---        ---        ---

  BUYERUX-004   P0         TODO      ---        ---        ---        ---

  BUYERUX-005   P0         TODO      ---        ---        ---        ---

  BUYERUX-006   P0         TODO      ---        ---        ---        ---

  BUYERUX-007   P0         TODO      ---        ---        ---        ---

  BUYERUX-008   P0         TODO      ---        ---        ---        ---

  BUYERUX-009   P1         TODO      ---        ---        ---        ---

  BUYERUX-010   P0         TODO      ---        ---        ---        ---

  BUYERUX-011   P1         TODO      ---        ---        ---        ---

  BUYERUX-012   P0         TODO      ---        ---        ---        ---

  BUYERUX-013   P1         TODO      ---        ---        ---        ---

  BUYERUX-014   P0         TODO      ---        ---        ---        ---

  BUYERUX-015   P1         TODO      ---        ---        ---        ---

  BUYERUX-016   P1         TODO      ---        ---        ---        ---

  BUYERUX-017   P0         TODO      ---        ---        ---        ---

  BUYERUX-018   P0         TODO      ---        ---        ---        ---

  BUYERUX-019   P1         TODO      ---        ---        ---        ---

  BUYERUX-020   P0         TODO      ---        ---        ---        ---

  BUYERUX-021   P1         TODO      ---        ---        ---        ---

  BUYERUX-022   P0         TODO      ---        ---        ---        ---

  BUYERUX-023   P0         TODO      ---        ---        ---        ---

  BUYERUX-024   P0         TODO      ---        ---        ---        ---

  BUYERUX-025   P0         TODO      ---        ---        ---        ---

  BUYERUX-026   P0         TODO      ---        ---        ---        ---

  BUYERUX-027   P0         TODO      ---        ---        ---        ---

  BUYERUX-028   P0         TODO      ---        ---        ---        ---

  BUYERUX-029   P1         TODO      ---        ---        ---        ---

  BUYERUX-030   P0         TODO      ---        ---        ---        ---

  BUYERUX-031   P0         TODO      ---        ---        ---        ---

  BUYERUX-032   P1         TODO      ---        ---        ---        ---

  BUYERUX-033   P1         TODO      ---        ---        ---        ---

  BUYERUX-034   P0         TODO      ---        ---        ---        ---

  BUYERUX-035   P0         TODO      ---        ---        ---        ---

  BUYERUX-036   P0         TODO      ---        ---        ---        ---

  BUYERUX-037   P0         TODO      ---        ---        ---        ---

  BUYERUX-038   P0         TODO      ---        ---        ---        ---

  BUYERUX-039   P0         TODO      ---        ---        ---        ---

  BUYERUX-040   P0         TODO      ---        ---        ---        ---

  BUYERUX-041   P1         TODO      ---        ---        ---        ---

  BUYERUX-042   P0         TODO      ---        ---        ---        ---

  BUYERUX-043   P0         TODO      ---        ---        ---        ---

  BUYERUX-044   P0         TODO      ---        ---        ---        ---

  BUYERUX-045   P0         TODO      ---        ---        ---        ---
  ------------------------------------------------------------------------------

## Seller experience coverage

  --------------------------------------------------------------------------------
  Requirement    Priority   Status     Shared     Netsons    AWS        UX/E2E
                                       evidence   evidence   evidence   evidence
  -------------- ---------- ---------- ---------- ---------- ---------- ----------
  SELLERUX-001   P0         TODO       ---        ---        ---        ---

  SELLERUX-002   P0         TODO       ---        ---        ---        ---

  SELLERUX-003   P0         TODO       ---        ---        ---        ---

  SELLERUX-004   P1         TODO       ---        ---        ---        ---

  SELLERUX-005   P0         TODO       ---        ---        ---        ---

  SELLERUX-006   P0         TODO       ---        ---        ---        ---

  SELLERUX-007   P1         TODO       ---        ---        ---        ---

  SELLERUX-008   P0         TODO       ---        ---        ---        ---

  SELLERUX-009   P0         TODO       ---        ---        ---        ---

  SELLERUX-010   P0         TODO       ---        ---        ---        ---

  SELLERUX-011   P0         TODO       ---        ---        ---        ---

  SELLERUX-012   P0         TODO       ---        ---        ---        ---

  SELLERUX-013   P0         TODO       ---        ---        ---        ---

  SELLERUX-014   P0         TODO       ---        ---        ---        ---

  SELLERUX-015   P1         TODO       ---        ---        ---        ---

  SELLERUX-016   P0         TODO       ---        ---        ---        ---

  SELLERUX-017   P0         TODO       ---        ---        ---        ---

  SELLERUX-018   P0         TODO       ---        ---        ---        ---

  SELLERUX-019   P1         TODO       ---        ---        ---        ---

  SELLERUX-020   P0         TODO       ---        ---        ---        ---

  SELLERUX-021   P1         TODO       ---        ---        ---        ---

  SELLERUX-022   P0         TODO       ---        ---        ---        ---

  SELLERUX-023   P0         TODO       ---        ---        ---        ---

  SELLERUX-024   P0         TODO       ---        ---        ---        ---

  SELLERUX-025   P0         TODO       ---        ---        ---        ---

  SELLERUX-026   P0         TODO       ---        ---        ---        ---

  SELLERUX-027   P0         TODO       ---        ---        ---        ---

  SELLERUX-028   P1         TODO       ---        ---        ---        ---

  SELLERUX-029   P0         TODO       ---        ---        ---        ---

  SELLERUX-030   P0         TODO       ---        ---        ---        ---

  SELLERUX-031   P0         TODO       ---        ---        ---        ---

  SELLERUX-032   P0         TODO       ---        ---        ---        ---

  SELLERUX-033   P0         TODO       ---        ---        ---        ---

  SELLERUX-034   P0         TODO       ---        ---        ---        ---

  SELLERUX-035   P0         TODO       ---        ---        ---        ---

  SELLERUX-036   P0         TODO       ---        ---        ---        ---

  SELLERUX-037   P0         TODO       ---        ---        ---        ---

  SELLERUX-038   P1         TODO       ---        ---        ---        ---

  SELLERUX-039   P1         TODO       ---        ---        ---        ---

  SELLERUX-040   P1         TODO       ---        ---        ---        ---

  SELLERUX-041   P0         TODO       ---        ---        ---        ---
  --------------------------------------------------------------------------------
