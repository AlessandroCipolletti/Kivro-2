#!/usr/bin/env python3
"""Idempotently record real M07 implementation evidence and open cross-milestone gates."""
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
  427: ('A real pinned OpenClaw inference is quiesced before local PAUSED and remains stopped; paid settlement and seller web control are not yet present.', 'M08 ledger; M13 command route; M14 seller UI; M16 paid E2E.', 'Pause a real paid long-running sandbox job from seller UI; prove no further provider calls or settlement while paused, then resume/cancel correctly.'),
  428: ('Real Worker supervisor and OpenClaw pause test confirm the local process state; cloud command delivery and graphical acknowledgement remain absent.', 'M13 authenticated command route; M14 seller UI; M16 paid E2E.', 'Web click -> durable PAUSE_REQUESTED -> authenticated Worker command -> broker quiescence and Docker PAUSED -> acknowledged PAUSED UI; lost ack stays requested.'),
  429: ('A local CLI exists, but the graphical local Worker control and real running Worker session are absent.', 'M12 local management surface; M14 seller UI; M16 runtime E2E.', 'Graphical local Pause works during cloud outage on a real running job; CLI remains supplementary.'),
  430: ('SQLite offline pause and real OpenClaw quiescence pass; Worker process restart plus authenticated cloud reconciliation remain untested.', 'M13 Worker sync route; M16 disconnected paid runtime E2E; M29 durable restart recovery.', 'Disconnect cloud, pause a running OpenClaw job locally, restart Worker, reconnect, and reconcile one authoritative PAUSED or safely terminal state without duplicate execution.'),
  431: ('Pinned OpenClaw runs in the verified whole-container Docker boundary and a real in-flight inference is quiesced before PAUSED; hostile child/plugin and restart cases are not complete.', 'M16 hostile capability fixture; M26 process-crash fault injection; M29 restart recovery.', 'Inspect pinned runtime process tree and hostile child/tool descendants before/while paused; prove all stop and no uncontrolled work survives reconnect or restart.'),
  432: ('Real pinned OpenClaw broker test aborts an in-flight inference before local PAUSED and checks no further calls; authoritative paid spend accounting is absent.', 'M08 ledger; M16 paid provider fixture; M26 lost/reordered control messages.', 'Pause during a paid provider request; no new call begins, in-flight work cancels or times out, usage accounting remains correct and paused job makes no further spend.'),
  433: ('Real pinned OpenClaw whole-container pause and explicit NOT_SUPPORTED refusal pass; CPU/GPU/media resource measurement for other supported capability types is absent.', 'M16 heavy capability fixture; hardware/provider readiness.', 'Measure CPU/GPU/provider activity before/after pause on each supported capability; unsupported mode returns PAUSE_NOT_SUPPORTED without cancellation.'),
  434: ('FULL_RESUME/RESTART_STEP/NOT_SUPPORTED is frozen in package/version/job contracts; no seller review UI or RESTART_STEP runtime exists.', 'M14 seller UI; M16 FULL_RESUME runtime; M29 checkpoint engine.', 'Publish each pause mode, show exact seller behavior before confirmation, prove FULL_RESUME continues, RESTART_STEP restarts from checkpoint, NOT_SUPPORTED is explicit.'),
  435: ('Job state can carry pause mode but no durable step checkpoint/store/runner exists.', 'M16 long-running runtime; M29 checkpoint persistence/recovery.', 'Pause during step N, restart Worker, resume from last durable checkpoint without rerunning completed expensive steps.'),
  436: ('No seller running-jobs dashboard or sanitized progress/cost stream exists.', 'M12/M14 seller dashboard; M16 real jobs; M33 cost data.', 'Desktop/mobile seller dashboard shows real running jobs, high-level stage, resource/cost estimate, output stage and pause mode without chain-of-thought.'),
  437: ('No buyer job detail/status renderer exists; local/cloud pause metadata is component-only.', 'M10 buyer UI; M13 job API; M16 paid pause E2E.', 'Buyer sees neutral Paused by provider state; inspect API/UI for zero seller filesystem/security/device detail.'),
  438: ('Worker-local configurable pause expiry stops execution; no authoritative cloud scheduler or ledger refund exists.', 'M08 ledger; M16 paid runtime; M29 bounded recovery scheduler.', 'Advance clock beyond configured pause deadline on paid job, stop runtime and release/refund once; no indefinite paused state after restarts.'),
  439: ('No M08 ledger or seller earnings exists; M07 never calls settlement on pause.', 'M08 reservation/ledger; M16 paid pause E2E; M26 races.', 'Pause reserved paid job, prove reservation remains within limit, zero seller earning until validated delivery, timeout releases/refunds exactly once.'),
  440: ('Local resume checks fresh readiness/security and Docker status; full dependency/provider rechecks and seller web route remain absent.', 'M13 command API; M14 UI; M16 paid runtime; M33 provider readiness.', 'Resume real paused job after dependency/security changes: each blocking code is correct and no unready job executes; healthy job continues.'),
  441: ('Per-job local resume is explicit but effective schedule and seller UI explanation are absent.', 'M14 seller UI; M30 schedule availability.', 'Resume accepted job outside schedule with seller confirmation while new jobs remain closed; UI explains the distinction.'),
  442: ('Local global pause blocks implicit resume unless explicit override, but web confirmation and paid routing are absent.', 'M13/M14 seller control; M16 paid E2E.', 'With global pause active, old job remains paused, explicit per-job override requires confirmation, and new offers stay blocked.'),
  443: ('Local SECURITY_PAUSED blocks seller resume; real policy detectors/alerts and sanitized buyer view are absent.', 'M12/M15 security health; M10 buyer view; M16 hostile runtime.', 'Trigger actual policy violation, freeze job locally, audit seller reason, deny resume until remediation and show only neutral buyer status.'),
  444: ('Shared reducer forbids pause from UPLOADING_RESULT; atomic durable upload and live command race have not been exercised.', 'M16 Worker upload E2E; M26 upload/pause fault injection; M29 finalization recovery.', 'Race pause with output processing/final upload, prove deterministic stage handling, no partial COMPLETED and no unsafe extra work.'),
  445: ('Explicit pause states and a real pinned OpenClaw pause path pass; distributed failure/reconciliation across live endpoints and both roots is incomplete.', 'M13 command route; M16 paid runtime; M19 provider roots; M26 fault injection.', 'Run all legal/illegal pause-resume transitions with duplicate/lost/reordered messages, restart and failure recovery against both provider roots.'),
  446: ('SQLite/PostgreSQL retries are idempotent and the real Worker loop emits command ACKs; live transport replay across reconnect is absent.', 'M13 Worker endpoint; M16 runtime; M26 duplicate-message faults.', 'Deliver the same pause/resume command and ack repeatedly across reconnect/crash; one local side effect and one cloud transition/audit per command.'),
  447: ('Seller ownership is checked in PostgreSQL and local OS owner controls CLI; authenticated web/pairing/policy actor routes are absent.', 'M13 API/Worker auth; M14 seller UI; M15 operator policy.', 'Buyer/prompt/unrelated seller cannot pause/resume; owning seller and authorized security actor can, with signed Worker scope.'),
  448: ('Cloud/local command tables store request/confirmation metadata in component tests; full event delivery and dispute view are absent.', 'M13 command API; M16 paid E2E; M15 audit view.', 'Read complete request/confirm/resume timeline after real web/local/offline pause, with actor, source, previous/new state, reason, mode and timestamps.'),
  449: ('Real pinned OpenClaw pause/quiescence and local audit pass; the full 16-item checklist still needs UI, payment, both-root and fault evidence.', 'M08 ledger; M10 buyer UI; M12 local UI; M13 API; M14 seller UI; M16 E2E; M19 parity; M26/M29 faults.', 'Execute every §449 checkbox on a real paid pinned OpenClaw job with local/cloud UI, process-tree/provider tests, refund, auth, restart and audit.'),
  450: ('Real pinned OpenClaw job can be locally paused/cancelled and global/capability new-offer stops exist; graphical seller control and paid E2E remain absent.', 'M12/M14 graphical seller controls; M08 ledger; M16 paid runtime E2E.', 'Seller can pause/cancel one running job, pause capability/all new jobs and inspect execution locally/offline; no paid job is operationally unstoppable.'),
}

evidence = {
  427: ('packages/contracts/src/job-control.ts,apps/worker/src/job-control.ts,apps/worker/src/execution-supervisor.ts,apps/worker/src/broker-sidecar.ts', 'tests/worker-job-control.test.mjs,tests/docker-worker-supervisor-local-integration.mjs'),
  428: ('packages/persistence/src/job-execution.ts,apps/worker/src/dispatch-loop.ts,apps/worker/src/job-control.ts,apps/worker/src/broker-sidecar.ts', 'tests/m07-result-postgres-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs,tests/docker-job-control-local-integration.mjs'),
  429: ('apps/worker/src/cli.ts,apps/worker/src/job-control.ts', 'tests/worker-job-control.test.mjs'),
  430: ('apps/worker/src/job-control.ts,apps/worker/src/dispatch-loop.ts', 'tests/worker-job-control.test.mjs,tests/docker-worker-supervisor-local-integration.mjs'),
  431: ('runtime/openclaw/Dockerfile,apps/worker/src/broker-sidecar.ts,packages/sandbox-adapter/src/docker.ts', 'tests/docker-openclaw-exec-local-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs'),
  432: ('apps/worker/src/broker-sidecar.ts,apps/worker/src/job-control.ts,packages/application/src/completion-broker.ts', 'tests/docker-worker-supervisor-local-integration.mjs,tests/openclaw-completion-broker.test.mjs'),
  433: ('packages/sandbox-adapter/src/docker.ts,apps/worker/src/job-control.ts', 'tests/docker-worker-supervisor-local-integration.mjs,tests/worker-job-control.test.mjs'),
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
  449: ('apps/worker/src/job-control.ts,apps/worker/src/execution-supervisor.ts,packages/persistence/src/job-execution.ts', 'tests/worker-job-control.test.mjs,tests/m07-result-postgres-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs'),
  450: ('apps/worker/src/cli.ts,apps/worker/src/job-control.ts,apps/worker/src/execution-supervisor.ts', 'tests/worker-job-control.test.mjs,tests/docker-worker-supervisor-local-integration.mjs'),
}

prior = {
  9: ('M07 transactional transitions, restart-stable leases, reconciliation and audit component tests pass; no M08 ledger or full distributed race/deadline proof exists.', 'M08 ledger; M13 authenticated API; M16 paid E2E; M26/M29 fault recovery.'),
  10: ('M07 one-time pairing, signed replay, heartbeat, discovery and outbound HTTPS polling adapter component tests pass; live cloud endpoints and WSS are absent.', 'M13 Worker API/pairing routes; M19 both deployment transports; M16 E2E.'),
  11: ('M07 real supervisor, pinned OpenClaw job, accepted-input auth, leases, outbox and polling transport components pass; live paid API path is absent.', 'M08 ledger; M13 authenticated Worker API; M16 paid E2E; M19 both roots.'),
  12: ('M07 real OpenClaw file read/write and validated private-output path pass; authenticated buyer API and paid file retrieval remain absent.', 'M08 ledger; M10 buyer UI; M13 API; M16 paid file E2E.'),
  13: ('Real OpenClaw completion bridge uses a seller credential outside sandbox and validated tool transcript; approved secret-store and live seller-provider E2E remain absent.', 'M12 seller setup; M16 secret-isolation E2E; M33 provider readiness.'),
  14: ('M06 named read-only DB broker and M07 policy-bound OpenClaw resource-tool router pass; a real selected seller DB through the whole paid route is absent.', 'M08 ledger; M13 API; M16 private-data E2E.'),
  15: ('Pinned OpenClaw runs with an exact allowlist, denied built-ins and real broker tool route; hostile published-skill and paid adversarial E2E remain absent.', 'M13 published capability route; M16 hostile job E2E; M19 both roots.'),
}

prior_evidence = {
  9: ('packages/domain/src/job-lifecycle.ts,packages/persistence/src/job-execution.ts,packages/persistence/migrations/0014_job_execution.sql', 'tests/job-lifecycle.test.mjs,tests/m07-postgres-integration.mjs'),
  10: ('apps/worker/src/device-identity.ts,packages/worker-protocol/src/auth.ts,packages/worker-protocol/src/transport.ts,packages/infrastructure/netsons/src/https-polling.ts,packages/persistence/src/worker-auth.ts,packages/persistence/src/worker-heartbeat.ts,packages/persistence/src/worker-pairing.ts', 'tests/worker-transport.test.mjs,tests/worker-https-polling.test.mjs,tests/m07-postgres-integration.mjs'),
  11: ('packages/persistence/src/job-execution.ts,apps/worker/src/job-admission.ts,apps/worker/src/execution-supervisor.ts,apps/worker/src/dispatch-loop.ts,packages/worker-protocol/src/messages.ts', 'tests/worker-admission.test.mjs,tests/m07-postgres-integration.mjs,tests/m07-result-postgres-integration.mjs,tests/docker-worker-supervisor-local-integration.mjs'),
  12: ('apps/worker/src/input-staging.ts,apps/worker/src/execution-supervisor.ts,packages/sandbox-adapter/src/docker.ts,packages/persistence/src/job-execution.ts', 'tests/input-staging.test.mjs,tests/docker-openclaw-file-tools-local-integration.mjs,tests/docker-output-storage-local-integration.mjs'),
  13: ('packages/openclaw-adapter/src/job-config.ts,apps/worker/src/broker-sidecar.ts,packages/application/src/completion-broker.ts', 'tests/openclaw-job-config.test.mjs,tests/openclaw-completion-broker.test.mjs,tests/docker-worker-supervisor-local-integration.mjs'),
  14: ('packages/application/src/local-resource-broker.ts,packages/persistence/src/postgres-readonly-resource.ts,apps/worker/src/broker-router.ts', 'tests/m06-postgres-integration.mjs,tests/worker-broker-router.test.mjs'),
  15: ('packages/contracts/src/worker-manifest.ts,packages/policy-engine/src/sandbox.ts,packages/openclaw-adapter/src/job-config.ts,runtime/openclaw/Dockerfile', 'tests/sandbox-policy.test.mjs,tests/openclaw-job-config.test.mjs,tests/docker-openclaw-exec-local-integration.mjs'),
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
        return lead + f'`DEFERRED_VERIFICATION`   {impl}   {tests}   M07 implementation evidence; cross-milestone gate backlog:{req_id}'
    impl, tests = evidence.get(sec, ('---', '---'))
    return lead + f'`DEFERRED_VERIFICATION`   {impl}   {tests}   M07 implementation evidence; cross-milestone gate backlog:{req_id}'

coverage = item.sub(rewrite, coverage)
assert len(mapped) == 119, len(mapped)
coverage_path.write_text(coverage)

lines = ['\n## M07 carry-forward\n',
         'All rows below remain OPEN as `DEFERRED_VERIFICATION`. M07 now has a real pinned OpenClaw job supervisor, selected broker/tool route, private image approval, and Docker execution conformance. These component tests do not replace paid, graphical, deployed-provider, restart or fault evidence. Every remaining gate names its later-owned dependency and exact closing test. An M07-owned implementation gap must be `OPEN_IMPLEMENTATION`, never hidden as deferred verification.\n',
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
