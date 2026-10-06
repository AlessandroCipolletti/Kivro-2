"""Record M09 evidence without changing the authoritative requirement catalog."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
requirements = (ROOT / 'spec/REQUIREMENTS.md').read_text()
coverage_path = ROOT / 'spec/COVERAGE.md'
backlog_path = ROOT / 'docs/verification-backlog.md'
coverage = coverage_path.read_text()
backlog = backlog_path.read_text()

mapped = {}
for match in re.finditer(r'^### ([A-Z]+-\d+) --- .+?\n(.*?)(?=^### |\Z)',
                         requirements, re.M | re.S):
    section = re.search(r'\*\*Source:\*\* MASTER-SPEC.md §(\d+)', match[2])
    if section and (int(section[1]) == 26 or 396 <= int(section[1]) <= 425 or
                    451 <= int(section[1]) <= 487):
        mapped[match[1]] = int(section[1])
assert len(mapped) == 150, len(mapped)

verified_sections = {399, 401, 402, 407, 408, 409, 410, 411, 412, 413, 417,
                     423, 456, 457, 462, 463, 466, 468, 471, 472, 474}
later_sections = {400, 405, 406, 416, 418, 419, 452, 453, 454, 458, 461,
                  465, 476, 477, 478, 479, 480, 481, 483}
verified_ids = {
    'AVL-0025', 'AVL-0026',
    'JOB-0119', 'JOB-0123', 'JOB-0125', 'JOB-0130', 'JOB-0132',
    'AVL-0046', 'AVL-0047', 'AVL-0060', 'PRD-0369',
    'JOB-0227', 'PRD-0373', 'PRD-0375', 'JOB-0229', 'JOB-0230',
    'AVL-0068', 'AVL-0069', 'AVL-0071', 'AGT-0101', 'JOB-0243',
}
later_ids = {'AVL-0023', 'JOB-0122', 'PRD-0354', 'PRD-0355', 'AVL-0050',
             'PRD-0357', 'PRD-0358', 'AVL-0061', 'AVL-0063',
             'JOB-0224', 'PAY-0110'}
deferred_ids = {'AVL-0002', 'AVL-0034', 'AVL-0036', 'AVL-0038',
                'PRD-0352', 'AVL-0052', 'AVL-0055', 'AVL-0056',
                'JOB-0134', 'AVL-0057', 'AVL-0058', 'JOB-0216',
                'JOB-0219', 'JOB-0222', 'PRD-0371', 'PRD-0381',
                'JOB-0242', 'PRD-0383'}

dependency = {
    26: ('M10 buyer marketplace and M13 API', 'Buyer/API E2E renders truthful status and rejects impossible immediate paid admission.'),
    396: ('M12 seller schedule controls', 'Seller browser test saves recurring schedule and proves Worker admission follows it.'),
    397: ('M10 buyer discovery', 'Buyer browser test keeps a PUBLIC schedule-closed capability discoverable with accurate next availability.'),
    398: ('M12 seller schedule editor', 'Seller browser test configures overnight windows and manual pause without ambiguity.'),
    403: ('M10 buyer status display', 'Buyer browser test distinguishes ONLINE, BUSY, SCHEDULED_OFFLINE, OFFLINE and PAUSED.'),
    404: ('M10 buyer checkout', 'Browser checkout shows schedule-closed state and rejects immediate payment before reservation.'),
    405: ('M11 Marketplace Agent', 'Agent fixtures use Core next-window computation and refuse to invent availability or bypass schedule.'),
    406: ('M13 authenticated REST API', 'API submit outside schedule fails with a structured denial and zero ledger reservation or Worker offer.'),
    414: ('M12 seller controls and M16 paid E2E', 'Seller consent and real paid execution test proves use only in authorized windows and limits.'),
    415: ('M26 laptop sleep fault injection', 'Real sleep/wake or network-loss fault test proves stale OFFLINE, safe waiting and readiness on return.'),
    420: ('M13 authenticated/public API', 'REST response conformance proves coarse availability and no weekly seller schedule leakage.'),
    421: ('M13 public API', 'REST buyer projection exposes status and next availability without leaking the recurring personal schedule.'),
    422: ('M13 API and M16 hostile prompt E2E', 'Authenticated seller-only schedule mutation and hostile buyer prompt test prove no control-plane change.'),
    424: ('M10 UI, M11 Agent, M13 API and M16 E2E', 'Complete §424 matrix across Core, buyer UI, REST, Agent and hostile input; run provider parity at M19.'),
    425: ('M13 job API and M16 paid E2E', 'Paid submission through the real API and Worker fails whenever any visibility, pause, schedule, device, readiness or capacity layer fails.'),
    451: ('M10 buyer scheduling checkout', 'Browser E2E schedules a closed capability and clearly distinguishes eligibility from immediate start.'),
    455: ('M33 seller reliability aggregation', 'Run paid scheduled jobs and verify seller runtime/reliability excludes reservation-to-eligibility wait.'),
    457: ('M10 buyer quote display', 'Browser checkout labels Core earliest eligibility as an estimate and never a guaranteed start.'),
    459: ('M10 buyer timing presentation', 'Buyer UI test labels uncertain or absent delivery estimates honestly without false precision.'),
    460: ('M10 buyer checkout', 'Browser test discloses immediate credit reservation and later execution before confirmation.'),
    464: ('M10 buyer job page', 'Browser test distinguishes schedule wait from eligible execution queue wait.'),
    467: ('M10 buyer notices and M13 durable notification delivery', 'Schedule edit E2E updates next eligibility, delivers notice, allows cancel and expires over deadline.'),
    469: ('M10 buyer job page', 'Offline-at-window browser E2E shows bounded Worker wait, then reconnect or release.'),
    470: ('M10 buyer notification delivery', 'Expiry E2E shows buyer notice and exactly-once credit release after restart.'),
    473: ('M10 buyer job page', 'Overflow E2E shows next window or full release when deadline expires.'),
    475: ('M10 buyer checkout', 'Browser checkout shows changed quote and obtains fresh buyer confirmation without charging stale terms.'),
    482: ('M13 authenticated webhook delivery', 'Subscriber replay/retry E2E delivers each scheduled lifecycle event with stable IDs.'),
    484: ('M12 seller dashboard', 'Seller browser test shows private window demand, workload and reserved value distinct from settled revenue.'),
    485: ('M12 seller pause UI', 'Seller browser test warns about already scheduled jobs before pause while preserving the ability to pause.'),
    486: ('M10 buyer UI and M13 durable notifications', 'Paid scheduled E2E verifies disclosed timing/payment, material notices, cancellation, expiry release and fair order.'),
    487: ('M10 marketplace discovery', 'Buyer browser test keeps scheduled supply visible, discloses earliest eligibility and permits bounded purchase.'),
}
later_owner = {
    400: 'M12 seller UI', 405: 'M11 Marketplace Agent', 406: 'M13 REST API',
    416: 'M12 seller guidance', 418: 'M12 seller UI', 419: 'M10 buyer UI',
    452: 'M10 buyer CTA', 453: 'M10 buyer checkout', 454: 'M10 buyer timing UI',
    458: 'M10 buyer copy', 461: 'M08 direct-card option and legal/payment review before use',
    465: 'M10 buyer job page', 476: 'M10 buyer locale UI', 477: 'M10 marketplace cards',
    478: 'M10 capability detail', 479: 'M11 Marketplace Agent',
    480: 'M11 Agent orchestration', 481: 'M13 REST API',
    483: 'M10 buyer notices and M13 notification delivery',
}

core_impl = 'packages/contracts/src/availability.ts,packages/persistence/src/availability.ts'
core_test = 'tests/m09-postgres-integration.mjs'
unit_sections = {399, 401, 417, 455, 456}
status_counts = {'VERIFIED': 0, 'DEFERRED_VERIFICATION': 0, 'TODO': 0,
                 'DEFERRED': 0}

for ident, section in mapped.items():
    if ident in verified_ids or section in verified_sections:
        status = 'VERIFIED'
    elif ident in later_ids or section in later_sections:
        status = 'TODO'
    else:
        assert section in dependency or ident in deferred_ids, (ident, section)
        status = 'DEFERRED_VERIFICATION'
    if ident in deferred_ids:
        status = 'DEFERRED_VERIFICATION'
    if ident in later_ids:
        status = 'TODO'
    if ident == 'JOB-0122':
        status = 'DEFERRED'
    status_counts[status] += 1
    unit = section in unit_sections
    impl = ('packages/domain/src/availability-schedule.ts,packages/contracts/src/availability.ts'
            if unit else core_impl)
    tests = ('tests/availability-schedule.test.mjs,tests/scheduled-job-metrics.test.mjs'
             if unit else core_test)
    if status == 'VERIFIED':
        note = 'M09 Core verified; docs/milestones/M09.md'
    elif status == 'DEFERRED_VERIFICATION':
        owner, evidence = dependency.get(section, (
            'M11/M13/M16 cross-system consumer',
            'Run the named Agent/API/hostile-input closing scenario over M09 authoritative Core.'))
        note = f'M09 component evidence; full gate OPEN; backlog:{ident}'
        row = (f'| `{ident}` (§{section}) | M09 Core has typed availability, booking and '
               f'reconciliation evidence, but the mapped acceptance also needs {owner}. | '
               f'{owner} | {evidence} |')
        if f'| `{ident}` (§{section}) |' in backlog:
            backlog = re.sub(rf'^\| `{ident}` \(§{section}\) \|[^\n]*$',
                             lambda _: row, backlog, flags=re.M)
        else:
            backlog += '\n' + row
    elif status == 'DEFERRED':
        note = 'Explicitly optional later stricter queued-job mode in Master Spec §408; MVP roll-forward policy verified'
    else:
        owner = later_owner.get(section, 'later-owned UI/API/Agent consumer')
        if ident in later_ids:
            owner = {'AVL-0023': 'M12 overnight editor',
                     'JOB-0122': 'optional post-MVP stricter queued-job mode from §408',
                     'PRD-0354': 'M12 seller guidance', 'PRD-0355': 'M12 seller guidance',
                     'AVL-0050': 'M12 schedule preview UI',
                     'PRD-0357': 'M10 buyer-local time UI', 'PRD-0358': 'M10 buyer-local time UI',
                     'AVL-0061': 'M10 buyer checkout', 'AVL-0063': 'M10 CTA wording',
                     'JOB-0224': 'M10 job page', 'PAY-0110': 'M10 checkout disclosure'}[ident]
        note = f'OPEN later-owned implementation: {owner}; M09 Core evidence in docs/milestones/M09.md'
    pattern = rf'^  `{ident}`\s+(P\d+)\s+§{section}\s+`[^`]+`[^\n]*$'
    row = f'  `{ident}`    \\1         §{section}      `{status}`   {impl}   {tests}   {note}'
    coverage, changed = re.subn(pattern, row, coverage, flags=re.M)
    assert changed == 1, (ident, changed)

closed_prior = {'PAY-0106', 'PAY-0107', 'PAY-0108', 'AVL-0008',
                'JOB-0079', 'JOB-0084', 'AVL-0013', 'AVL-0014',
                'JOB-0088', 'JOB-0089'}
for ident in closed_prior:
    matches = re.findall(rf'^  `{ident}`\s+P\d+\s+§(\d+)', coverage, re.M)
    assert len(matches) == 1, ident
    section = matches[0]
    row = (f'  `{ident}`    P1         §{section}      `VERIFIED`   '
           f'{core_impl},packages/persistence/src/job-execution.ts   {core_test}   '
           'M09 real PostgreSQL two-buyer slot race, heartbeat TTL, deterministic order or release; docs/milestones/M09.md')
    coverage, changed = re.subn(rf'^  `{ident}`[^\n]*$', row, coverage, flags=re.M)
    assert changed == 1, ident
    backlog, removed = re.subn(rf'^\| `{ident}` \(§\d+\) \|[^\n]*\n', '', backlog, flags=re.M)
    assert removed in (0, 1), (ident, removed)

prior_remaining = {}
def carry(ids, dependency_text, closing):
    for ident in ids.split():
        prior_remaining[ident] = (dependency_text, closing)

carry('CAP-0037 CAP-0038 CAP-0039 CAP-0040 CAP-0041 CAP-0042',
      'M12/M14 complete seller wizard and publish review',
      'Complete the seller wizard, including explicit schedule review, test/readiness validation and final consent before publication.')
carry('API-0020 API-0021', 'M13 authenticated API rate limits',
      'Burst/concurrent API tests enforce buyer, capability and Worker limits with zero extra reservations.')
carry('AVL-0004 AVL-0005', 'M10 buyer UI, M11 Agent, M13 API and M19 two provider roots',
      'Run the same availability conformance suite across UI, Agent, API and both provider roots.')
carry('JOB-0074 JOB-0075 JOB-0076', 'M13 authenticated Worker route and M16 real broken-dependency E2E',
      'Run actual Worker heartbeat with healthy and individually broken sandbox, inference and dependency prerequisites; paid admission follows readiness.')
carry('JOB-0077 JOB-0078', 'M10 buyer BUSY presentation and M16 paid Worker queue E2E',
      'Browser/Worker E2E fills slots, displays BUSY and truthful or absent ETA, then queues only within policy.')
carry('AVL-0006 AVL-0007 AVL-0009', 'M10 buyer UI, M11 Agent and M26 sleep fault test',
      'Real sleep/disconnect plus buyer/API/Agent E2E blocks immediate purchase and selects waiting only by explicit buyer preference.')
carry('JOB-0080 JOB-0081', 'M12 seller controls and M13 cloud/Worker control sync',
      'Seller pause/resume across UI and Worker becomes authoritative before new offers; running job policy remains explicit.')
carry('JOB-0082', 'M12 seller pause UI',
      'Seller UI tests pause, timed pause, audit and precedence over schedule while existing jobs obey policy.')
carry('PRD-0329 PRD-0330', 'M16 paid two-Worker capacity E2E',
      'Concurrent buyers and two Workers prove seller/platform limits hold and buyer/Agent cannot raise them.')
carry('JOB-0083', 'M12 seller queue controls and M16 buyer queue E2E',
      'Seller configures queue size; real buyer E2E fills/rejects queue and restart expiry releases credit exactly once.')
carry('WRK-0099 WRK-0100', 'M13 authenticated Worker heartbeat route and M26 failover fault test',
      'Real signed heartbeat/reconnect/replay across control planes proves freshness, privacy and safe failover.')
carry('AVL-0010 AVL-0011 AVL-0012', 'M13 Worker route and M26 physical sleep/wake fault test',
      'Sleep/wake or Wi-Fi loss marks OFFLINE, prevents offers, reconciles jobs and restores only after fresh readiness.')
carry('AVL-0015 AVL-0016', 'M16 two-capability dependency-failure E2E',
      'Break one live capability dependency and prove only that capability becomes blocked while another stays eligible.')
carry('UI-0024 UI-0025', 'M10 buyer marketplace',
      'Accessible browser test renders every authoritative status with text, action and truthful wait/queue indication.')
carry('AVL-0017 AVL-0018', 'M11 Marketplace Agent',
      'Agent fixtures enforce authoritative availability and explain refusal without hallucinating a time.')
carry('CAP-0088 CAP-0089', 'M13 authenticated job API',
      'API race tests reject paused, schedule-closed and full-capacity paid submission with zero charge/offer.')
carry('JOB-0085 JOB-0086', 'M26 real disconnect during running paid job',
      'Disconnect/reconnect or fail a real running job; no blind rerun or false delivery, with one correct financial outcome.')
carry('JOB-0087', 'M16 multi-buyer/multi-Worker queue E2E and M26 reconnect fault',
      'Real multi-Worker reconnect and capacity race preserves accepted order without duplicate claim.')
carry('AVL-0019 AVL-0020', 'M15 availability observability and reputation policy',
      'Derive uptime, capacity, misses and wait distributions from durable events without premature laptop-seller penalty.')

for ident, (missing, closing) in prior_remaining.items():
    reason = ('M09 Core PostgreSQL queue/availability tests and Worker readiness component '
              'evidence now exist; the full mapped gate needs the named consumer or fault proof.')
    pattern = rf'^\| `{ident}` \(§(\d+)\) \|[^\n]*$'
    backlog, changed = re.subn(pattern, lambda m: (
        f'| `{ident}` (§{m[1]}) | {reason} | {missing} | {closing} |'),
        backlog, flags=re.M)
    assert changed == 1, (ident, changed)

assert sum(status_counts.values()) == 150
coverage_path.write_text(coverage)
backlog_path.write_text(backlog)
print(status_counts, 'prior gates closed', len(closed_prior))
