#!/usr/bin/env python3
"""Idempotently record M07 component evidence without closing cross-system gates."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
coverage_path = ROOT / 'spec/COVERAGE.md'
backlog_path = ROOT / 'docs/verification-backlog.md'
coverage = coverage_path.read_text()
backlog = backlog_path.read_text()
backlog = backlog.split('\n## M07 carry-forward\n')[0].rstrip() + '\n'

# Each row states a missing real dependency and the full acceptance test.
sections = {
  426: ('Seller web/desktop job detail and authenticated command delivery are absent.', 'M13 seller API; M14 graphical seller job UI; M16 paid Worker E2E.', 'Browser E2E: owning seller pauses one running paid job from graphical job detail without CLI, unrelated seller/buyer denied.'),
  427: ('Local and database pause semantics pass component tests; no actual paid OpenClaw execution has been paused.', 'M08 ledger; M13 command route; M16 pinned OpenClaw paid E2E.', 'Pause a real paid long-running sandbox job, prove execution and spend stop while resumable state persists; cancel remains terminal.'),
  428: ('Cloud PAUSE_REQUESTED and local Docker PAUSED are distinct in component tests; failed Worker control stays requested with an audit entry; live command delivery/UI is absent.', 'M13 command route; M14 seller UI; M16 paid Worker E2E.', 'Web click -> durable request -> authenticated Worker command -> whole-container stop -> local persistence/ack -> PAUSED UI; lost or failed ack shows request, not pause.'),
  429: ('A local CLI exists, but the graphical local Worker control and real running Worker session are absent.', 'M12 local management surface; M14 seller UI; M16 runtime E2E.', 'Graphical local Pause works during cloud outage on a real running job; CLI remains supplementary.'),
  430: ('SQLite offline pause/restart component tests pass; no real disconnected OpenClaw job and cloud resync exist.', 'M13 Worker sync route; M16 real runtime/disconnect E2E; M26 fault injection.', 'Disconnect cloud, pause a running container locally, verify no new work, restart Worker, reconnect and reconcile authoritative PAUSED once.'),
  431: ('A repository-built pinned OpenClaw image starts inside the Kivro offline sandbox; a real Alpine pause test checks child presence and Docker status. OpenClaw job descendants/provider activity are untested.', 'M07 OpenClaw job supervisor and broker route; M16 hostile long-running job; M26 crash tests.', 'Inspect pinned runtime process tree and tool descendants before/while paused, prove all stop and no uncontrolled child work survives reconnect/restart.'),
  432: ('Offline Docker pause blocks local process calls, but marketplace provider bridge/in-flight request cancellation is absent.', 'M07 brokered OpenClaw runtime; M16 inference E2E; M33 provider cost limits.', 'Pause during a provider request: no new calls begin, in-flight call cancels or times out boundedly, spend accounting stays truthful and paused job spends nothing further.'),
  433: ('Docker pause works for an Alpine container; resumable GPU/media/LLM capability and resource measurements are absent.', 'M16 pinned runtime and heavy capability fixture; hardware/provider readiness.', 'Measure CPU/GPU/provider activity before/after pause on each supported capability; unsupported mode returns PAUSE_NOT_SUPPORTED without cancellation.'),
  434: ('FULL_RESUME/RESTART_STEP/NOT_SUPPORTED is frozen in package/version/job contracts; no seller review UI or RESTART_STEP runtime exists.', 'M14 seller UI; M16 FULL_RESUME runtime; M29 checkpoint engine.', 'Publish each pause mode, show exact seller behavior before confirmation, prove FULL_RESUME continues, RESTART_STEP restarts from checkpoint, NOT_SUPPORTED is explicit.'),
  435: ('Job state can carry pause mode but no durable step checkpoint/store/runner exists.', 'M16 long-running runtime; M29 checkpoint persistence/recovery.', 'Pause during step N, restart Worker, resume from last durable checkpoint without rerunning completed expensive steps.'),
  436: ('No seller running-jobs dashboard or sanitized progress/cost stream exists.', 'M12/M14 seller dashboard; M16 real jobs; M33 cost data.', 'Desktop/mobile seller dashboard shows real running jobs, high-level stage, resource/cost estimate, output stage and pause mode without chain-of-thought.'),
  437: ('No buyer job detail/status renderer exists; local/cloud pause metadata is component-only.', 'M10 buyer UI; M13 job API; M16 paid pause E2E.', 'Buyer sees neutral Paused by provider state; inspect API/UI for zero seller filesystem/security/device detail.'),
  438: ('Worker-local configurable pause expiry and stop pass component tests; no cloud scheduler or ledger refund exists.', 'M08 ledger; M16 runtime; M29 bounded recovery scheduler.', 'Advance clock beyond configured pause deadline on paid job, stop runtime and release/refund once; no indefinite paused state after restarts.'),
  439: ('No M08 ledger or seller earnings exists; M07 never calls settlement on pause.', 'M08 reservation/ledger; M16 paid pause E2E; M26 races.', 'Pause reserved paid job, prove reservation remains within limit, zero seller earning until validated delivery, timeout releases/refunds exactly once.'),
  440: ('Local resume checks fresh readiness/security and Docker status; dependency/provider rechecks and web route are absent.', 'M13 command API; M14 UI; M16 runtime; M33 provider readiness.', 'Resume real paused job after dependency/security changes: each blocking code is correct and no unready job executes; healthy job resumes checkpoint.'),
  441: ('Per-job local resume is explicit but effective schedule and seller UI explanation are absent.', 'M14 seller UI; M30 schedule availability.', 'Resume accepted job outside schedule with seller confirmation while new jobs remain closed; UI explains the distinction.'),
  442: ('Local global pause blocks implicit resume unless explicit override, but web confirmation and paid routing are absent.', 'M13/M14 seller control; M16 paid E2E.', 'With global pause active, old job remains paused, explicit per-job override requires confirmation, and new offers stay blocked.'),
  443: ('Local SECURITY_PAUSED blocks seller resume; real policy detectors/alerts and sanitized buyer view are absent.', 'M12/M15 security health; M10 buyer view; M16 hostile runtime.', 'Trigger actual policy violation, freeze job locally, audit seller reason, deny resume until remediation and show only neutral buyer status.'),
  444: ('Shared reducer forbids pause from UPLOADING_RESULT; atomic durable upload and live command race have not been exercised.', 'M16 Worker upload E2E; M26 upload/pause fault injection; M29 finalization recovery.', 'Race pause with output processing/final upload, prove deterministic stage handling, no partial COMPLETED and no unsafe extra work.'),
  445: ('Explicit pause states pass reducer/PostgreSQL/local component tests; distributed failure/reconciliation is incomplete.', 'M13 command route; M16 runtime; M26 fault injection.', 'Run all legal/illegal pause-resume transitions with duplicate/lost/reordered messages, restart and failure recovery against both provider roots.'),
  446: ('SQLite and PostgreSQL component retries are idempotent; actual transport replay across reconnect is absent.', 'M13 Worker route; M16 runtime; M26 duplicate-message faults.', 'Deliver the same pause/resume command and ack repeatedly across reconnect/crash; one local side effect and one cloud transition/audit per command.'),
  447: ('Seller ownership is checked in PostgreSQL and local OS owner controls CLI; authenticated web/pairing/policy actor routes are absent.', 'M13 API/Worker auth; M14 seller UI; M15 operator policy.', 'Buyer/prompt/unrelated seller cannot pause/resume; owning seller and authorized security actor can, with signed Worker scope.'),
  448: ('Cloud/local command tables store request/confirmation metadata in component tests; full event delivery and dispute view are absent.', 'M13 command API; M16 paid E2E; M15 audit view.', 'Read complete request/confirm/resume timeline after real web/local/offline pause, with actor, source, previous/new state, reason, mode and timestamps.'),
  449: ('Only component assertions pass; the full 16-item per-job acceptance checklist spans later product/runtime/payment work.', 'M08 ledger; M10 buyer UI; M12 local UI; M13 API; M14 seller UI; M16 E2E; M26 faults.', 'Execute every §449 checkbox on a real paid pinned OpenClaw job with local/cloud UI, process-tree/provider tests, refund, auth and audit.'),
  450: ('Local CLI and sandbox stop exist; no complete graphical seller control set or paid unstoppable-job test exists.', 'M12/M14 graphical seller controls; M08 ledger; M16 paid runtime E2E.', 'Seller can pause/cancel one running job, pause capability/all new jobs and inspect execution locally/offline; no paid job is operationally unstoppable.'),
}

evidence = {
  427: ('packages/contracts/src/job-control.ts,apps/worker/src/job-control.ts', 'tests/worker-job-control.test.mjs'),
  428: ('packages/persistence/src/job-execution.ts,apps/worker/src/job-control.ts,packages/sandbox-adapter/src/docker.ts', 'tests/m07-result-postgres-integration.mjs,tests/docker-job-control-local-integration.mjs,tests/docker-controlled-execution-local-integration.mjs'),
  429: ('apps/worker/src/cli.ts,apps/worker/src/job-control.ts', 'tests/worker-job-control.test.mjs'),
  430: ('apps/worker/src/job-control.ts', 'tests/worker-job-control.test.mjs'),
  431: ('runtime/openclaw/Dockerfile,runtime/openclaw/package-lock.json,packages/sandbox-adapter/src/docker.ts', 'tests/docker-openclaw-image-local-integration.mjs,tests/docker-job-control-local-integration.mjs,tests/docker-controlled-execution-local-integration.mjs'),
  432: ('packages/sandbox-adapter/src/docker.ts', 'tests/docker-job-control-local-integration.mjs'),
  433: ('packages/sandbox-adapter/src/docker.ts', 'tests/docker-job-control-local-integration.mjs'),
  434: ('packages/contracts/src/job-control.ts,packages/contracts/src/capability-package.ts,packages/contracts/src/capability-version.ts', 'tests/capability-version.test.mjs,tests/worker-job-control.test.mjs'),
  438: ('apps/worker/src/job-control.ts', 'tests/worker-job-control.test.mjs,tests/docker-controlled-execution-local-integration.mjs'),
  439: ('packages/persistence/src/job-execution.ts', 'tests/m07-result-postgres-integration.mjs'),
  440: ('apps/worker/src/job-control.ts', 'tests/worker-job-control.test.mjs'),
  442: ('apps/worker/src/job-control.ts,apps/worker/src/local-state.ts', 'tests/worker-job-control.test.mjs,tests/worker-local-state.test.mjs'),
  443: ('apps/worker/src/job-control.ts,packages/domain/src/job-lifecycle.ts', 'tests/worker-job-control.test.mjs'),
  444: ('packages/domain/src/job-lifecycle.ts,packages/persistence/src/job-execution.ts', 'tests/job-lifecycle.test.mjs'),
  445: ('packages/domain/src/job-lifecycle.ts,packages/persistence/src/job-execution.ts', 'tests/job-lifecycle.test.mjs,tests/m07-postgres-integration.mjs'),
  446: ('apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts', 'tests/worker-job-control.test.mjs,tests/m07-result-postgres-integration.mjs'),
  447: ('packages/persistence/src/job-execution.ts,apps/worker/src/cli.ts', 'tests/m07-result-postgres-integration.mjs'),
  448: ('apps/worker/src/job-control.ts,packages/persistence/migrations/0014_job_execution.sql', 'tests/worker-job-control.test.mjs,tests/m07-result-postgres-integration.mjs'),
  449: ('apps/worker/src/job-control.ts,packages/persistence/src/job-execution.ts', 'tests/worker-job-control.test.mjs,tests/m07-result-postgres-integration.mjs'),
  450: ('apps/worker/src/cli.ts,apps/worker/src/job-control.ts', 'tests/worker-job-control.test.mjs'),
}

prior = {
  9: ('M07 transactional transitions, restart-stable leases, reconciliation and audit component tests pass; no M08 ledger or full distributed race/deadline proof exists.', 'M08 ledger; M13 authenticated API; M16 paid E2E; M26/M29 fault recovery.'),
  10: ('M07 one-time pairing, signed replay, heartbeat, discovery and outbound HTTPS polling adapter component tests pass; live cloud endpoints and WSS are absent.', 'M13 Worker API/pairing routes; M19 both deployment transports; M16 E2E.'),
  11: ('M07 offer, manifest, lease, reconciliation and local-admission components pass; no actual authenticated paid OpenClaw transport path exists.', 'M08 ledger; M13 Worker API; M16 runtime E2E; M19 both profiles.'),
  12: ('M05 file checks and M07 input/output manifest components pass; live paid Worker file flow is absent.', 'M08 ledger; M13 API; M16 full file E2E.'),
  13: ('Local identity, scoped broker primitives and a repository-built pinned OpenClaw version probe exist; no OpenClaw job has exercised credential routing.', 'M07 brokered runtime integration; M16 secret-isolation E2E.'),
  14: ('M06 named read-only DB broker passes component tests; OpenClaw tool route is absent.', 'M07 pinned runtime integration; M16 private-data E2E.'),
  15: ('Deny-default policy and Docker offline tests include a pinned OpenClaw version probe; actual OpenClaw job tool enforcement is absent.', 'M07 pinned runtime integration; M16 adversarial tool E2E.'),
}

prior_evidence = {
  9: ('packages/domain/src/job-lifecycle.ts,packages/persistence/src/job-execution.ts,packages/persistence/migrations/0014_job_execution.sql', 'tests/job-lifecycle.test.mjs,tests/m07-postgres-integration.mjs'),
  10: ('apps/worker/src/device-identity.ts,packages/worker-protocol/src/auth.ts,packages/worker-protocol/src/transport.ts,packages/infrastructure/netsons/src/https-polling.ts,packages/persistence/src/worker-auth.ts,packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/worker-pairing.ts', 'tests/worker-transport.test.mjs,tests/worker-https-polling.test.mjs,tests/m07-postgres-integration.mjs'),
  11: ('packages/persistence/src/job-execution.ts,apps/worker/src/job-admission.ts,packages/worker-protocol/src/messages.ts', 'tests/worker-admission.test.mjs,tests/m07-postgres-integration.mjs,tests/m07-result-postgres-integration.mjs'),
  12: ('apps/worker/src/input-staging.ts,packages/sandbox-adapter/src/docker.ts,packages/persistence/src/job-execution.ts', 'tests/input-staging.test.mjs,tests/docker-sandbox-output-local-integration.mjs,tests/m07-result-postgres-integration.mjs'),
  13: ('packages/openclaw-adapter/src/worker-environment.ts,packages/application/src/provider-broker.ts', 'tests/worker-environment.test.mjs,tests/provider-broker.test.mjs'),
  14: ('packages/application/src/local-resource-broker.ts,packages/persistence/src/postgres-readonly-resource.ts', 'tests/m06-postgres-integration.mjs'),
  15: ('packages/contracts/src/worker-manifest.ts,packages/policy-engine/src/sandbox.ts,packages/sandbox-adapter/src/docker.ts,runtime/openclaw/Dockerfile', 'tests/sandbox-policy.test.mjs,tests/docker-sandbox-local-integration.mjs,tests/docker-openclaw-image-local-integration.mjs'),
}

item = re.compile(r'^(\s*`([A-Z]+-\d+)`\s+P[0-3]\s+§(\d+)\s+)(.*)$', re.M)
mapped = []
def rewrite(match):
    lead, req_id, source, tail = match.groups()
    sec = int(source)
    if sec not in set(range(9, 16)) | set(range(426, 451)):
        return match.group(0)
    mapped.append((req_id, sec))
    if sec < 426:
        impl, tests = prior_evidence[sec]
        return lead + f'`DEFERRED_VERIFICATION`   {impl}   {tests}   M07 component evidence only; backlog:{req_id}'
    impl, tests = evidence.get(sec, ('---', '---'))
    return lead + f'`DEFERRED_VERIFICATION`   {impl}   {tests}   M07 component evidence only; backlog:{req_id}'

coverage = item.sub(rewrite, coverage)
assert len(mapped) == 119, len(mapped)
coverage_path.write_text(coverage)

lines = ['\n## M07 carry-forward\n',
         'All rows below remain OPEN as `DEFERRED_VERIFICATION`. M07 component tests do not replace their full closing tests. The M07 implementation stage itself is still OPEN: the repository-built OpenClaw image has only a version/isolation probe, not job execution conformance or production approval; an effective tool/broker route, Worker execution supervisor and authenticated cloud delivery are missing. Later-milestone dependencies are listed per row; M07-owned missing work is not treated as completed merely because the verification status is deferred.\n',
         '| Requirement | Why verification is not yet possible | Missing dependency | Exact closing evidence |\n',
         '| --- | --- | --- | --- |\n']
for req_id, sec in mapped:
    if sec < 426:
        row = re.compile(rf'^\| `{re.escape(req_id)}` \(§{sec}\) \| ([^|]*) \| ([^|]*) \| ([^|]*) \|$', re.M)
        why, dependency = prior[sec]
        found = row.search(backlog)
        assert found, req_id
        backlog = backlog[:found.start()] + f'| `{req_id}` (§{sec}) | {why} | {dependency} | {found.group(3).strip()} |' + backlog[found.end():]
        continue
    assert sec in sections
    why, dependency, closing = sections[sec]
    assert f'`{req_id}` (§{sec})' not in backlog
    lines.append(f'| `{req_id}` (§{sec}) | {why} | {dependency} | {closing} |\n')
backlog_path.write_text(backlog.rstrip() + '\n' + ''.join(lines))
