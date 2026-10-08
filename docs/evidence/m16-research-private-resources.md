# M16 public research and seller-private resource boundary

The production Worker now routes seller-selected `kivro_research_*` tools through
signed, lease-bound control-plane RPCs. The Cloud reads the immutable published
research policy and secured payment state for every operation. The Worker never
receives the platform search credential. A PostgreSQL private-resource barrier
waits for in-flight research and denies later egress. Seller-selected file and
database reads establish that barrier before returning private bytes. Missing
Cloud routing, lease, policy, broker, or barrier refuses the tool call.

The local review uses a separate durable SQLite research budget and explicit
seller approval for seller-host egress. Paid jobs use Cloud egress. The same
package authoring path can select research, declared API, read-only database,
and local file tools independently; discovery alone grants none of them.

## Executable evidence

- `tests/m16-installed-worker-e2e.mjs`, run by `pnpm test:e2e:local`:
  authenticated seller approval of one immutable research-plus-selected-file
  version; distinct buyer permission detail; credit-secured job; signed
  `RESEARCH_FETCH` followed by `PRIVATE_RESOURCE_READ`; real installed Worker,
  Docker/OpenClaw, selected-file broker, private output and exactly one ledger
  settlement. The model receives only the selected seller bytes. The buyer
  page contains no host path or unselected bytes.
- `tests/m06-postgres-integration.mjs`, run with Docker by
  `pnpm test:resource:e2e`: one reviewed and seller-published version declares
  research, a dedicated read-only PostgreSQL database, a selected company
  file and one fixed read-only private API connector. Real Docker/OpenClaw
  calls the research, database, selected-file and declared-API brokers in that
  order. The buyer detail shows seller inference, public research, database
  read-only, selected files, private API read-only, no browser, no shell, and
  no external side effects. The database role cannot read private tables or
  write; the API is fixed to a HEAD request on a declared public host; the
  selected-file audit contains no path or bytes. Public HTML contains no DB
  URL, credential, connector ID or seller path.
- `tests/m06-postgres-integration.mjs` also probes Cloud research admission:
  accepted worker/plane/lease, active attempt, secured payment and immutable
  version must all match. Concurrent research/private-read operations serialize
  and post-private-read requests are rejected.
- `tests/docker-broker-sidecar-local-integration.mjs` proves the offline
  sandbox can reach only its authenticated sidecar, private/metadata destinations
  are refused, HTML is sanitized and research after a private read is denied.
- `tests/selected-local-file.test.mjs`,
  `tests/docker-selected-file-broker-local-integration.mjs`, and
  `tests/docker-openclaw-selected-file-local-integration.mjs` probe undeclared
  paths, traversal, symlinks, special files, mutations, stale content and no
  host filesystem mount. File-only fixtures explicitly deny public Internet;
  a package combining both requires the Cloud barrier.

The complete Stripe-funded release chain is separate and remains open. These
tests use development credits or a representative review job. Do not use this
document as Stripe or final release evidence.
