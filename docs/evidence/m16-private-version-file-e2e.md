# M16 changed-version, private-buyer and file-input E2E review

Original source reviewed: Master Spec §§12, 32 and 318.

The passing `pnpm test:e2e:local` run on 2026-10-07 uses distinct seller and
buyer accounts. Version 2 uses a read-only discovered and explicitly selected
skill snapshot with a declared remote-model fixture. An authenticated seller
publishes it through Web approval; a paid Docker/OpenClaw job completes with a
private result. Version 3 changes the skill bytes and content hash, selected
model route, inference configuration and dependency snapshot. Its representative
Docker/OpenClaw review runs again. The seller approves the changed version in
the Web form, including the version-change acknowledgement. The private Worker
package store refuses to install v3 with v2 skill bytes, then reopens the
correct reviewed v3 bytes after process restart. PostgreSQL retains distinct
immutable v2/v3 package and dependency hashes, v2's external processor
declaration, and the completed v2 paid result. The paid v3 job uses the local
model and its new frozen package; old behavior is not overwritten.

The v3 seller form publishes the capability as PRIVATE. The seller then uses
the actual Web visibility/grant control to grant access to the verified buyer
account. Another account's API key receives 404 for the private capability.
The granted buyer opens the authentic capability page, enters structured
input, uploads `source.txt` by signed private PUT and receives a Core quote.
The paid REST purchase uses the same READY asset. The host-native Worker
fetches it, runs pinned Docker/OpenClaw with no host fallback, validates and
uploads two output files to private S3-compatible storage, and settles one
ledger journal. The buyer reopens the completed job in Web and downloads both
files; the other account receives 404. Development credits are strictly
non-production; this is not Stripe test purchase evidence.

The §12 file contract allows a narrow MIME/extension/size/count set and
rejects archives, so decompression and nested-archive attacks are not admitted.
Input is staged under the isolated read-only `/job/input`; work/output are
separate. The real paid Docker probe confirms no seller home, Documents,
Downloads, Desktop, SSH, personal OpenClaw or Docker socket mount. Hostile
output paths and symlinks fail in real Docker tests. Live ClamAV EICAR and
scanner-outage tests reject/hold files fail closed, and the Worker cleans
temporary attempt state after completion/failure. The buyer-visible files
remain behind authenticated access and configured retention.

Evidence: `tests/m16-core-worker-integration.mjs`,
`tests/m16-installed-worker-e2e.mjs`,
`tests/docker-sandbox-local-integration.mjs`,
`tests/docker-sandbox-output-local-integration.mjs`,
`tests/io-readiness.test.mjs`, `tests/m15-clamav-live.test.mjs`,
`docs/evidence/m16-boundaries.json` (the latest complete matrix must be green
before it is cited as a passing same-diff suite), and browser captures in
`docs/evidence/m16-browser/`.

The supported portable Worker installer/signed update channel, real Stripe
test funding and ready Connect account remain separate open gates. This
development-credit E2E does not close §§45, 56, 88 or 92 by aggregation.
