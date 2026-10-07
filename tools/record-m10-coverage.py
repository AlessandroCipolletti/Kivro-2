"""Record the reviewed M10 evidence while keeping later-owned work open."""
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
    if section and (int(section[1]) in (28, 29) or
                    120 <= int(section[1]) <= 161 or
                    356 <= int(section[1]) <= 368):
        mapped[match[1]] = int(section[1])
assert len(mapped) == 148, len(mapped)

verified = set('''PRD-0089 PRD-0090 PRD-0091 PRD-0092 PRD-0093 PRD-0094
PRD-0096 PRD-0097 PRD-0098 CAP-0052 JOB-0057 JOB-0058 JOB-0059
PRD-0099 PRD-0100 PRD-0142 PRD-0143 PRD-0144 PRD-0147 PRD-0148
CAP-0055 CAP-0096 CAP-0098 CAP-0099 CAP-0100 PRD-0335 CAP-0102
CAP-0103 CAP-0104 IO-0140 IO-0141 IO-0142 CAP-0106 IO-0143 IO-0144
PRD-0334'''.split())

# Broad acceptance claims stay open where the M10 implementation exists but
# their complete evidence needs a named later component or physical E2E test.
deferred = {
    28: ('The buyer pages, quote and cancellation are browser-tested, but a paid file/result journey through a real Worker is not yet exercised.',
         'M13 authenticated Worker endpoints and M16 paid local E2E',
         'Run browser purchase→private file upload→real sandboxed Worker→validated output→private preview/download after browser restart.'),
    29: ('Structured job/audit and review revision evidence exists, but the full seller-visible execution audit and secret-redaction path is not exercised through the buyer flow.',
         'M14 seller audit UI and M16 hostile paid execution',
         'Run a paid job with secret-bearing input, inspect structured seller/buyer audits and prove credentials, paths and full private inputs never appear.'),
    120: ('One web account can buy without local OpenClaw and the browser flow works; combined seller activation and paid Worker result remain untested.',
          'M14 seller activation and M16 paid Worker E2E',
          'Use one login to buy and retrieve a real result on a device without Worker/OpenClaw, then activate selling under the same account with seller prerequisites.'),
    121: ('Buyer credits and seller earnings remain separate in M08; the unified two-direction account journey is not yet rendered end to end.',
          'M14 seller earnings UI and M16 paid two-direction E2E',
          'Buy and sell with one account, inspect separate available/reserved credits and pending/available/paid earnings, and prove no automatic netting.'),
    124: ('The capability detail renders current contracts, examples, price, reviews, permissions and refund copy; the Marketplace Agent action is later-owned.',
          'M11 Marketplace Agent',
          'Browser test the detail page Ask Marketplace Agent action using only the current public catalog document and preserving the manual purchase gate.'),
    127: ('History, current-version Run Again, settlement review and cancellation are tested; durable file preview/download through a real paid Worker is not.',
          'M13 authenticated Worker route and M16 paid file E2E',
          'Return in a new browser session to completed and failed jobs, preview/download retained private output, report a problem and run again at changed current terms.'),
    152: ('Discover, Categories, Favorites, My Jobs and Selling navigation exist; AI Request is owned by the Agent milestone.',
          'M11 Marketplace Agent UI',
          'Desktop/mobile navigation test reaches AI Request and returns to buyer/seller sections under one login without a dead destination.'),
    356: ('M10 uses shared version/I-O/permission/price/availability/finance services; formal REST and MCP consumers and deployment parity are absent.',
          'M11 Agent, M13 REST/MCP, M19 both provider composition roots',
          'Run one contract fixture through web, Agent, REST/MCP and both provider roots with identical admission, version, price and delivery semantics.'),
    357: ('Core accepts seller-authorized version-bound examples and enforces the configured limit; seller authoring guidance/UI is not yet present.',
          'M14 seller example authoring UI',
          'Seller browser test creates 0–3 examples, receives guidance to add two, approves assets and publishes only after contract validation.'),
    360: ('Buyer example text, labels and a seller-approved text file download pass with real SeaweedFS; image/video/3D preview and large-media behavior remain untested.',
          'M16 SeaweedFS-backed browser file E2E',
          'Publish seller-owned approved image, video and 3D input examples; inspect safe preview/download metadata on mobile and desktop without leaking local paths.'),
    361: ('Safe Markdown/JSON and image/video/audio/PDF/generic output renderers exist; media routes have no real storage browser fixture yet.',
          'M16 SeaweedFS-backed browser media E2E',
          'Publish approved output examples of each supported MIME, inspect sandboxed preview/download and verify active content never executes.'),
    363: ('Core requires seller ownership and explicit example publication; the seller approval flow for assets is not yet available in the UI.',
          'M14 seller example approval UI and M16 private/public storage E2E',
          'Attempt publication of buyer files, seller local paths, secrets and unapproved assets; approve a seller-owned asset and verify only that asset becomes public.'),
    368: ('M10 stores/displays contract-safe examples and templates, but the full checklist includes real seller test publication, version revalidation, Agent use and media E2E.',
          'M11 Agent, M14 seller Test Playground, M16 storage E2E',
          'Execute all eleven §368 checkboxes, including successful real test→seller approval, incompatible version invalidation, safe media, Agent metadata and template reuse.'),
}

later_owner = {
    **{section: 'M11 Marketplace Agent and orchestration' for section in range(129, 152)},
    **{section: 'M11 Agent evaluation/orchestration' for section in range(157, 162)},
    359: 'M14 seller Test Playground and example publication',
    365: 'M14 seller version publication/revalidation UI',
    366: 'M11 Marketplace Agent',
}
later_ids = {
    'PRD-0083': 'M14 combined buyer/seller activation under one login',
    'PRD-0084': 'M14 combined buyer/seller account journey',
    'PRD-0086': 'M14 seller prerequisites and publishing UI',
    'PRD-0087': 'M11 AI Request and M14 seller workspace sections',
    'PRD-0088': 'M14 seller earnings journey under the buyer login',
    'PRD-0095': 'M11 Ask Marketplace Agent action on capability detail',
    'OBS-0001': 'M14 seller-visible structured execution audit',
    'OBS-0002': 'M14 seller-visible structured execution audit',
    'OBS-0003': 'M14 seller audit presentation with M16 hostile-input redaction test',
    'PRD-0140': 'M11 AI Request navigation',
    'PRD-0141': 'M11 AI Request navigation',
    'PRD-0331': 'M11 Agent, M13 REST/MCP consumers and M19 provider parity',
    'PRD-0332': 'M11 Agent, M13 REST/MCP consumers and M19 provider parity',
    'CAP-0095': 'M14 seller example authoring UI',
    'PRD-0145': 'M11 semantic Agent matching over category-independent public documents',
    'PRD-0146': 'M11 Agent semantic discovery index consumer',
    'CAP-0097': 'M14 seller example authoring guidance',
    'CAP-0101': 'M14 real seller Test Playground→example publication',
    'CAP-0105': 'M14 version-change example compatibility workflow',
    'CAP-0107': 'M14 seller revalidation before using an old example',
    'CAP-0108': 'M14 runtime/model/skill-change rerun guidance',
    'PRD-0336': 'M14 seller approval UI for public example assets',
    'CAP-0109': 'M11 Agent, M14 real test publication and M16 media acceptance',
}

impl = ('packages/contracts/src/marketplace.ts,packages/persistence/src/marketplace-catalog.ts,'
        'packages/persistence/src/marketplace-social.ts,packages/persistence/src/marketplace-buyer.ts,'
        'packages/persistence/src/marketplace-assets.ts,apps/web/app/discover,apps/web/app/buyer,'
        'apps/web/app/capabilities')
tests = 'tests/m10-postgres-integration.mjs,tests/browser-m10/marketplace.spec.ts'
counts = {'VERIFIED': 0, 'DEFERRED_VERIFICATION': 0, 'TODO': 0}
for ident, section in mapped.items():
    if ident in verified:
        status = 'VERIFIED'
        note = 'M10 PostgreSQL/browser evidence; docs/milestones/M10.md'
        backlog = re.sub(rf'^\| `{ident}` \(§{section}\) \|[^\n]*\n', '', backlog, flags=re.M)
    elif ident in later_ids or section in later_owner:
        status = 'TODO'
        owner = later_ids.get(ident, later_owner.get(section))
        note = f'OPEN later-owned implementation: {owner}; M10 public catalog primitive available where applicable'
        backlog = re.sub(rf'^\| `{ident}` \(§{section}\) \|[^\n]*\n', '', backlog, flags=re.M)
    else:
        assert section in deferred, (ident, section)
        status = 'DEFERRED_VERIFICATION'
        why, missing, closing = deferred[section]
        note = f'M10 component evidence; full gate OPEN; backlog:{ident}'
        row = f'| `{ident}` (§{section}) | {why} | {missing} | {closing} |'
        pattern = rf'^\| `{ident}` \(§{section}\) \|[^\n]*$'
        backlog, changed = re.subn(pattern, lambda _: row, backlog, flags=re.M)
        if not changed:
            backlog += '\n' + row
        else:
            assert changed == 1, (ident, changed)
    counts[status] += 1
    pattern = rf'^  `{ident}`\s+(P\d+)\s+§{section}\s+`[^`]+`[^\n]*$'
    replacement = (f'  `{ident}`    \\1         §{section}      `{status}`   '
                   f'{impl}   {tests}   {note}')
    coverage, changed = re.subn(pattern, replacement, coverage, flags=re.M)
    assert changed == 1, (ident, changed)

# This narrow earlier gate is fully closed by the real settled-job review
# authorization and cross-buyer/self-review database checks. Broader §86
# reputation metrics remain on the backlog.
ident = 'PRD-0071'
coverage, changed = re.subn(rf'^  `{ident}`[^\n]*$',
    f'  `{ident}`    P1         §86      `VERIFIED`   '
    f'packages/persistence/src/marketplace-social.ts,packages/persistence/migrations/0017_marketplace.sql   '
    f'{tests}   Settled delivery only; unpaid, duplicate and cross-buyer reviews rejected',
    coverage, flags=re.M)
assert changed == 1
backlog, removed = re.subn(r'^\| `PRD-0071` \(§86\) \|[^\n]*\n', '', backlog, flags=re.M)
assert removed in (0, 1)

# M10 now supplies the final browser-status consumer of the M09 public
# projection; M11/M13/M19 parity rows remain open.
for ident in ('UI-0024', 'UI-0025'):
    pattern = rf'^  `{ident}`\s+(P\d+)\s+§349\s+`[^`]+`[^\n]*$'
    replacement = (f'  `{ident}`    \\1         §349      `VERIFIED`   '
                   f'packages/persistence/src/availability.ts,apps/web/app/discover/marketplace-ui.tsx,'
                   f'apps/web/app/capabilities/[slug]/page.tsx   {tests}   '
                   'Browser checked ONLINE, BUSY, SCHEDULED_OFFLINE, OFFLINE, PAUSED and readiness blocked with text on card/detail')
    coverage, changed = re.subn(pattern, replacement, coverage, flags=re.M)
    assert changed == 1, ident
    backlog, removed = re.subn(rf'^\| `{ident}` \(§349\) \|[^\n]*\n', '', backlog, flags=re.M)
    assert removed in (0, 1), ident

closed_prior = {
    'AVL-0021': ('397', 'PUBLIC schedule-closed listing and next availability on detail'),
    'AVL-0032': ('403', 'Browser rendered all five authoritative availability states'),
    'AVL-0033': ('404', 'Immediate schedule-closed checkout refused before reservation'),
    'AVL-0034': ('404', 'Immediate schedule-closed checkout refused before reservation'),
    'AVL-0059': ('451', 'Scheduled browser purchase booked for a future window'),
    'JOB-0219': ('457', 'Earliest eligibility shown without guaranteed start'),
    'JOB-0221': ('459', 'Buyer sees unknown completion ETA instead of invented precision'),
    'JOB-0222': ('459', 'Buyer sees unknown completion ETA instead of invented precision'),
    'PAY-0109': ('460', 'Scheduled quote discloses credit reservation now and later execution'),
    'PRD-0382': ('487', 'Schedule-closed capability remains discoverable and schedulable'),
    'PRD-0383': ('487', 'Schedule-closed capability remains discoverable and schedulable'),
    'IO-0130': ('234', 'Current I/O contract drives concise card input/output badges'),
}
for ident, (section, evidence) in closed_prior.items():
    pattern = rf'^  `{ident}`\s+(P\d+)\s+§{section}\s+`[^`]+`[^\n]*$'
    replacement = (f'  `{ident}`    \\1         §{section}      `VERIFIED`   '
                   f'{impl}   {tests},tests/m09-postgres-integration.mjs   {evidence}')
    coverage, changed = re.subn(pattern, replacement, coverage, flags=re.M)
    assert changed == 1, ident
    backlog, removed = re.subn(rf'^\| `{ident}` \(§{section}\) \|[^\n]*\n', '', backlog, flags=re.M)
    assert removed in (0, 1), ident

prior_open = {}
def carry(ids, reason, missing):
    for item in ids.split():
        prior_open[item] = (reason, missing)

carry('PRD-0068 PRD-0069',
      'M10 public PostgreSQL search, filters and real published supply pass; semantic routing remains unbuilt.',
      'M11 Marketplace Agent routing')
carry('PRD-0070 PRD-0072',
      'M10 settled-job reviews and seller/capability rating aggregates pass; success, refund and reliability metrics remain open.',
      'M33 full reputation/reliability aggregation')
carry('PRD-0083 PRD-0084 PRD-0086 PRD-0087',
      'M10 buyer/account navigation and paid web purchase pass; the complete seller activation and AI Request journeys are later-owned.',
      'M11 Agent navigation and M14 seller onboarding/workspace')
carry('PRD-0085',
      'M10 browser purchase works without a buyer-side Worker; real paid output retrieval has not run.',
      'M13 authenticated Worker route, M14 seller activation and M16 paid browser-to-Worker E2E')
carry('SEC-0092 SEC-0093 SEC-0094 SEC-0095 SEC-0096 SEC-0097 SEC-0098 '
      'CAP-0067 CAP-0068 CAP-0069 CAP-0070',
      'M10 buyer detail renders the public permission taxonomy; effective real-runtime policy parity needs a complete fixture.',
      'M16 paid pinned-OpenClaw manifest/runtime parity E2E')
carry('PRD-0080 PRD-0081 PRD-0082',
      'M10 buyer marketplace explains current contracts and privacy; one complete paid dependency-closure audit is absent.',
      'M16 real paid capability/Worker E2E')
carry('PRD-0320 PRD-0321 PRD-0322',
      'M10 Core private-grant and cross-buyer denial tests pass; the actual two-account file/Worker/result journey is absent.',
      'M13 authenticated Worker route and M16 two-account paid E2E')
carry('IO-0013 IO-0014 IO-0015 IO-0016 IO-0017 IO-0018 IO-0019 IO-0020 '
      'IO-0021 IO-0022 IO-0023 IO-0024 IO-0025 IO-0026 IO-0027 IO-0028',
      'M10 real SeaweedFS browser upload, private result route and ownership tests pass; Worker round trip is absent.',
      'M13 authenticated Worker route and M16 paid file round-trip E2E')
carry('PRD-0192 PRD-0193 PRD-0194 PRD-0195',
      'M10 buyer detail warns about seller-device processing and sensitive uploads without claiming confidential computing.',
      'M14 seller data declaration and M16 buyer file E2E')
carry('PRD-0239',
      'M10 buyer detail shows declared public-research access and private-network exclusion; seller policy and real execution remain open.',
      'M14 seller network approval and M16 brokered paid research E2E')
carry('PRD-0365 PRD-0366 PRD-0367',
      'M10 job/history labels render neutral provider pause states without seller diagnostics; no real paid pause browser run exists.',
      'M16 real paid per-job pause browser E2E')
carry('JOB-0038 JOB-0039 JOB-0040 JOB-0041',
      'M10 job timeline uses persisted lifecycle transitions and omits fake progress; real paid Worker-stage rendering is untested.',
      'M16 real paid Worker progress/result browser E2E')
carry('IO-0088 IO-0089 IO-0090',
      'M10 buyer result renderer consumes finalized output contracts and private asset IDs; real paid manifest/file delivery is untested.',
      'M16 paid Docker/OpenClaw output-to-buyer E2E')
carry('PRD-0253 PRD-0254 PRD-0255 PRD-0256 PRD-0257',
      'M10 buyer job shows validated result/limitation text; blocked-site behavior still needs a real brokered paid run.',
      'M16 paid broker research failure E2E')
carry('CAP-0078',
      'M10 stores public marketing metadata separately from immutable versions; authenticated seller edits are not yet available.',
      'M14 seller metadata editor and M13 seller API')
carry('JOB-0223 AVL-0066 JOB-0231',
      'M10 buyer page distinguishes schedule, queue and Worker waits by authoritative status; physical queue/window faults are untested.',
      'M16 paid Worker queue/window E2E and M26 disconnect fault')
carry('AVL-0070',
      'M10 purchase revalidates the quote and clears a stale quote for fresh confirmation; browser price-change race is untested.',
      'M16 paid repricing/browser race E2E')
carry('PRD-0374',
      'M10 job history shows durable expiry and M09 releases credits; outbound buyer notification delivery is missing.',
      'M13 durable notification delivery and M16 restart/expiry E2E')
for ident, (reason, missing) in prior_open.items():
    match = re.search(rf'^\| `{ident}` \(§\d+\) \|[^\n]*$', backlog, re.M)
    if not match:
        continue
    cells = match[0].split('|')
    assert len(cells) == 6, ident
    updated = f'| {cells[1].strip()} | {reason} | {missing} | {cells[4].strip()} |'
    backlog = backlog[:match.start()] + updated + backlog[match.end():]
    old = re.search(rf'^  `{ident}`[^\n]*$', coverage, re.M)
    if old and '`DEFERRED_VERIFICATION`' in old[0] and not any(
            marker in old[0] for marker in ('M10 component:','M10 buyer source:')):
        coverage = (coverage[:old.end()] +
                    f' M10 component: apps/web/src/marketplace,apps/web/app/discover,'
                    f'apps/web/app/buyer; {tests}; full gate OPEN.' +
                    coverage[old.end():])

# Earlier backlog rows often still said "no buyer form/page" and named M10 as
# missing even after its component existed. Reconcile those descriptions now;
# keep every broad closing scenario open until its later dependency is real.
later_names = {
    'M11': 'Marketplace Agent', 'M12': 'seller operations UI',
    'M13': 'formal authenticated API and notifications',
    'M14': 'seller authoring and publication UI', 'M15': 'operator controls',
    'M16': 'real paid Worker/browser E2E', 'M19': 'both deployment roots',
    'M26': 'sleep and restart fault tests', 'M29': 'durable asset reconciliation',
    'M33': 'reputation aggregation',
}
for row in list(re.finditer(r'^\| `([A-Z]+-\d+)` \(§\d+\) \|[^\n]*$',backlog,re.M)):
    cells=row[0].split('|')
    if len(cells)!=6 or 'M10' not in cells[3]:
        continue
    ident=row[1]
    remaining=sorted(set(re.findall(r'\bM(?:1[1-6]|19|26|29|33)\b',cells[3])),
                     key=lambda value:int(value[1:]))
    if not remaining:
        remaining=['M16']  # Buyer trust claims need runtime/data-flow parity.
    missing='; '.join(f'{m} {later_names[m]}' for m in remaining)
    reason=('M10 buyer routes and forms now exist; the full '
            'mapped cross-system closing scenario below remains open.')
    updated=f'| {cells[1].strip()} | {reason} | {missing} | {cells[4].strip()} |'
    backlog=backlog.replace(row[0],updated,1)
    old=re.search(rf'^  `{ident}`[^\n]*$',coverage,re.M)
    if old and '`DEFERRED_VERIFICATION`' in old[0] and not any(
            marker in old[0] for marker in ('M10 component:','M10 buyer source:')):
        coverage=(coverage[:old.end()] +
                  ' M10 buyer source: apps/web/app/capabilities,apps/web/app/buyer; '
                  'full cross-system closing test remains OPEN.' + coverage[old.end():])

assert sum(counts.values()) == 148, counts
coverage_path.write_text(coverage)
backlog_path.write_text(backlog)
print(counts, 'previously deferred gates closed:', 3 + len(closed_prior))
