"""Idempotent M02 health/pause evidence classification.

The generated rows remain OPEN until their exact closing test exists.
"""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
coverage_path = ROOT / "spec/COVERAGE.md"
backlog_path = ROOT / "docs/verification-backlog.md"

# Each tuple is reason, missing dependency, and required closing evidence.
gates = {
    369: ("Worker dashboard has no live health sources or rendered page.", "M04 sandbox readiness; M07 heartbeat/jobs; M14 seller dashboard.", "Browser/API test of summary, connection, sandbox, jobs and independent capability health from real Worker events."),
    370: ("Worker summary cannot report real availability from an unpaired Worker.", "M04 sandbox proof; M07 heartbeat; M14 seller dashboard.", "Heartbeat disconnect/reconnect test and dashboard snapshot showing independently computed Worker status."),
    371: ("Worker/cloud version window and update status are absent.", "M07 protocol negotiation; M17 release compatibility; M14 dashboard.", "Version-window fixtures for current/outdated/revoked Worker and dashboard update/status checks."),
    372: ("Local version detection exists, but a pinned supported range and cloud/UI status do not.", "M02 pinned adapter compatibility; M14 dashboard; M17 release policy.", "Pinned OpenClaw-version acceptance/rejection fixtures and seller UI status from actual Worker diagnostics."),
    373: ("Docker probing exists, but effective sandbox image/self-test and dashboard proof do not.", "M04 sandbox and policy self-test; M14 dashboard.", "Real Docker/image/policy self-test, missing-Docker fail-closed test and independent dashboard health fields."),
    374: ("There is no authenticated Worker heartbeat or observed cloud connection.", "M07 Worker connection/heartbeat; M14 dashboard.", "Disconnect/reconnect heartbeat test proving local/cloud state distinction and OFFLINE marketplace status."),
    375: ("No durable execution attempts or meaningful job metrics exist.", "M07 job/attempt persistence; M14 seller dashboard.", "Seeded and real-attempt tests for running/queued/last success/failure/runtime/failure rate with platform cancellation classification."),
    376: ("Capability runtime, dependency checks and dashboard do not exist.", "M03 published capabilities; M04 readiness; M07 jobs; M14 dashboard.", "Multi-capability integration/UI test proving independent health, capacity, queue and dependency status."),
    377: ("Security warning schema/UI and real detector inputs are absent.", "M04 policy/sandbox detectors; M07 health events; M14 dashboard.", "Inject version, sandbox, permission and credential warnings; assert severity, affected target, action, blocking status and seller display."),
    378: ("Critical warning detection cannot yet force all dispatch paths closed.", "M04 sandbox/security detectors; M07 dispatch; M13 API; M14 UI.", "Critical sandbox-failure fault test proving automatic pause before notice and blocked API/dispatch with accurate UI severity."),
    379: ("Local health CLI exists, but real Worker/cloud/sandbox/job observations are unavailable.", "M04 sandbox readiness; M07 Worker connection/jobs.", "Run health text/JSON against healthy, offline, stale, paused and sandbox-failed real Worker states; verify secret redaction."),
    380: ("Doctor currently reports honest critical failures; complete active readiness checks need runtime components.", "M02 pinned compatibility/device pairing; M04 sandbox; M07 cloud connection.", "Real doctor diagnostics for compatible and incompatible OpenClaw, Docker, sandbox, identity and cloud; no secrets in output."),
    381: ("Cloud health event history and seller timeline are absent.", "M07 durable health events; M14 dashboard.", "Disconnect, sandbox fail/recover and reconnect timeline test with sanitized retained events and correct cause ordering."),
    382: ("Local CLI pause works, but web control and live marketplace exclusion do not.", "M07 dispatch; M13 seller API; M14 seller dashboard.", "Seller CLI/web pause test proving immediate exclusion from job offers, public Run and Agent selection."),
    383: ("Local pause persists, but cloud, API, Agent, queue and running-job semantics are not connected.", "M07 dispatch/jobs; M11 Agent; M13 API; M14 UI.", "Online/offline emergency-pause E2E covering all nine §383 effects and local-cloud reconciliation."),
    384: ("SQLite commit/restart evidence exists, but no real execution admission path consumes it.", "M07 Worker offer admission and reconnect; M26 crash fault injection.", "Kill/restart/offline Worker test proving no offer acceptance after pause until explicit verified resume."),
    385: ("Web pause needs authenticated cloud state and dispatch gate.", "M07 dispatch; M13 seller API; M14 web dashboard.", "Seller web pause test while Worker connected proving cloud blocks new offers/API jobs before Worker acknowledgement."),
    386: ("Offline Worker/cloud pause sync path does not exist.", "M07 reconnect state reconciliation; M13 seller API.", "Pause offline Worker from web, reconnect, assert pause is applied before ONLINE or any claim/offer."),
    387: ("Local pending revision exists, but reconnect reporting to cloud is absent.", "M07 authenticated Worker transport and reconciliation.", "Pause during cloud outage, reconnect, assert persisted pause revision makes all capabilities PAUSED before dispatch."),
    388: ("No running-job supervisor exists to prove pause preserves in-flight work or stronger stop confirmation.", "M07 execution supervisor; M08 refund rules; M14 seller controls.", "Pause with a running paid job and prove continuation; separate explicit stop test with confirmation and correct financial outcome."),
    389: ("Queued paid jobs, maximum wait and refund/release path do not exist.", "M07 durable queue; M08 ledger/refunds; M30 deadlines.", "Pause queued paid job, assert no execution; resume before max wait or expire and verify exact-once release/refund."),
    390: ("Local resume denies absent readiness; complete security/dependency/inference/capability checks are not wired.", "M02 identity/compatibility; M03 capabilities; M04 sandbox; M07 connection.", "Resume acceptance and denial matrix using actual Worker security, dependency, inference and capability health before ONLINE."),
    391: ("Local capability pause exists, but cloud/web state and dispatch parity do not.", "M07 dispatch/reconciliation; M13 API; M14 dashboard.", "Capability-specific CLI/web pause and resume test proving global pause override across Worker/cloud offers."),
    392: ("Local append-only audit exists, but web/admin/cloud events and buyer privacy projection do not.", "M07 cloud events; M13 API; M14 seller/buyer views.", "CLI/web/platform/admin pause-resume audit test for actor/source/scope/time/reason and buyer-safe redaction."),
    393: ("Local security pause cannot be seller-cleared, but critical-condition detection and authenticated release are absent.", "M04 security detectors; M07 signed control plane; M13 policy release.", "Trigger critical sandbox/version/credential fault, assert automatic pause, seller resume denial and policy-authorized release only after resolution."),
    394: ("Several local pause checks pass, but the 16-item acceptance list requires live cloud, queue, Agent, API, UI and execution.", "M07 dispatch/jobs; M08 ledger; M11 Agent; M13 API; M14 UI; M26 fault injection.", "Execute all 16 §394 acceptance cases including offline sync, queued/running behavior, security override, audit and max-wait outcomes."),
    395: ("Local health/pause CLI is partial; seller cannot yet inspect all live operational data or pause from web.", "M04 readiness; M07 jobs/heartbeat; M14 seller dashboard.", "Seller operational E2E proving all §395 questions answer from actual state and local/web pause works during cloud outage."),
}

coverage = coverage_path.read_text()
backlog = backlog_path.read_text()
existing_backlog_ids = set(re.findall(r"^\| `([A-Z]+-\d+)` \(§", backlog, re.M))
entries = []
updated = 0
local_evidence = {
    372: ("packages/openclaw-adapter/src/discovery.ts", "tests/openclaw-discovery.test.mjs"),
    373: ("apps/worker/src/cli.ts", "tests/worker-cli.test.mjs"),
    379: ("apps/worker/src/cli.ts", "tests/worker-cli.test.mjs"),
    380: ("apps/worker/src/cli.ts", "tests/worker-cli.test.mjs"),
    382: ("apps/worker/src/local-state.ts; apps/worker/src/cli.ts", "tests/worker-local-state.test.mjs; tests/worker-cli.test.mjs"),
    383: ("apps/worker/src/local-state.ts", "tests/worker-local-state.test.mjs"),
    384: ("apps/worker/src/local-state.ts", "tests/worker-local-state.test.mjs"),
    387: ("apps/worker/src/local-state.ts", "tests/worker-local-state.test.mjs"),
    390: ("apps/worker/src/local-state.ts", "tests/worker-local-state.test.mjs"),
    391: ("apps/worker/src/local-state.ts", "tests/worker-local-state.test.mjs"),
    392: ("apps/worker/src/local-state.ts", "tests/worker-local-state.test.mjs"),
    393: ("apps/worker/src/local-state.ts", "tests/worker-local-state.test.mjs"),
    394: ("apps/worker/src/local-state.ts", "tests/worker-local-state.test.mjs"),
    395: ("apps/worker/src/cli.ts", "tests/worker-cli.test.mjs"),
}
for match in list(re.finditer(r"^  `([A-Z]+-\d+)`\s+(P[0-3])\s+§(\d+)\s+`TODO`[^\n]*$", coverage, re.M)):
    requirement, priority, section_text = match.group(1, 2, 3)
    section = int(section_text)
    if section not in gates:
        continue
    if requirement == "WRK-0107":
        replacement = f"  `{requirement}`    {priority}         §{section}     `VERIFIED`   apps/worker/src/cli.ts   tests/worker-cli.test.mjs   JSON health option"
    else:
        implementation, test = local_evidence.get(section, ("---", "---"))
        replacement = f"  `{requirement}`    {priority}         §{section}     `DEFERRED_VERIFICATION`   {implementation}   {test}   OPEN; see backlog"
        if requirement not in existing_backlog_ids:
            reason, dependency, closing = gates[section]
            entries.append(f"| `{requirement}` (§{section}) | {reason} | {dependency} | {closing} |")
    coverage = coverage.replace(match.group(0), replacement, 1)
    updated += 1

if updated not in (0, 66):
    raise SystemExit(f"Expected 66 unclassified health/pause IDs or an already classified table, found {updated}; no files written")
if updated == 0:
    print("Health/pause coverage already classified")
    raise SystemExit(0)

coverage_path.write_text(coverage)
backlog_path.write_text(backlog + ("\n" if not backlog.endswith("\n") else "") + "\n".join(entries) + "\n")
print(f"Classified {updated} IDs and added {len(entries)} backlog rows")
