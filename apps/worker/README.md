# Seller Worker

The host-native Worker foundation has local SQLite pause/audit state, a version-only isolated OpenClaw probe, a read-only metadata discovery adapter, an Ed25519 device identity with OS keychain primary storage and explicit encrypted-file fallback, and a CLI (`pnpm worker health --json`, `pnpm worker doctor --json`, `pnpm worker pause --all`). `pnpm worker pair <one-time-code>` proves possession of that device identity to the seller-authorized cloud pairing endpoint. Set `KIVRO_CLOUD_URL` to the Kivro Web/API origin; local loopback HTTP additionally requires `KIVRO_ALLOW_LOCAL_HTTP=true`. After pairing, `pnpm worker discover` (or `pnpm worker discover --json`) reads file-backed OpenClaw metadata locally. It reports uncertainty, never prints secret values or skill bodies, and neither selects resources nor uploads discovery to the cloud. Pairing alone never selects or publishes a capability. M03 seller import drafts and explicit selection/consent records are stored in a separate private local SQLite file; discovery candidates carry no consent or execution permission.

M07 adds durable per-job local pause/resume/cancel commands and Docker process-tree control. `pnpm worker job pause <job-id>` and `pnpm worker job cancel <job-id>` work only for registered local executions with matching container identity. An offline local pause is persisted before Docker is asked to stop the job; `PAUSED` is recorded only after Docker confirms it. The cloud pairing repository issues one-time codes, and the authenticated Web route plus signed Worker CLI redemption now connect it to seller onboarding. `pnpm test:openclaw:image` builds the repository image from locked OpenClaw 2026.8.2 and verifies a version probe under Kivro's offline sandbox; that probe alone does not approve paid execution. M13 adds signed cloud job RPC routes that check Worker identity, plane, lease, payment and durable output. The host-native control sync still reports zero paid capacity until a complete production supervisor composition has passed its real execution gate. It must never fall back to personal OpenClaw or execute a paid offer outside the sandbox.

# Seller-local import drafts

For the currently supported **single skill + dedicated remote inference**
profile, `kivro-worker import guided` is an interactive path with no hand-edited
JSON. It explains local execution, scans read-only, requires a separate explicit
selection for every dependency, checks a pre-existing dedicated OS-vault
credential, asks for the buyer contract, sample input, fixed launch price tier
and provider-cost ceilings, stages the private package, and runs the same
isolated review as `import review`. It never asks for the secret value in the
terminal. Configure it first with `credential set ... --from-fd`. A failed
test leaves an unreviewed local package; a lost cloud acknowledgement after a
successful test can use `import review-retry <version-id>`. The seller must
still inspect and approve the signed review in the Web dashboard. Unsupported
or ambiguous discovered resources stop this guided profile instead of being
silently omitted; the advanced commands below retain the full graph for
inspection but do not authorize unsupported execution.

After pairing, `kivro-worker discover` reads OpenClaw metadata locally without
running an OpenClaw listing command. To choose one unambiguous skill, run
`kivro-worker import start <skill-name>`. The command writes a private local
draft with **no selected dependencies**, reports uncertainty and shows each
suggested dependency ID. Use `kivro-worker import show <draft-id>` and
`kivro-worker import select <draft-id> <dependency-id> --allow` (or `--deny`)
to record each local choice. These commands do not grant runtime access,
publish a capability or transmit the personal OpenClaw inventory to Kivro.
Choose an inference route explicitly with
`kivro-worker import inference <draft-id> remote <provider> <model> <seller:credential-ref>`
or `kivro-worker import inference <draft-id> local <provider> <model> <endpoint-ref>`.
This adds **unselected, untested candidates** to the local dependency graph;
it never reuses a personal OpenClaw credential implicitly. For a remote route,
put a dedicated credential in the local OS vault with
`kivro-worker credential set <seller:credential-ref> --from-fd <fd>` and
review every new dependency with `import select`. Changing the inference route
requires a fresh draft so an earlier selection or consent cannot silently
carry over to a different provider or model.
Final permission consent, readiness tests and publication are separate gates.

For a skill whose only selected dependencies are the skill itself and a
dedicated remote provider, model and credential, `kivro-worker import package
<draft-id> <private-config.json>` now creates an **unreviewed** local package.
The configuration file must be owned by the current user, have no group or
world access, be a regular file, and be at most 64 KiB. It supplies a new
capability/version UUID, exact input and output contracts, one catalog price
tier, provider request/token/spend ceilings, runtime limits, concurrency and
pause behavior. The Worker derives its identity from the paired device and
copies the selected skill bytes read-only into its private import store; it
does not accept a Worker identity from the file. The advanced package file
can bind named read-only database operations, declared read-only APIs, local
inference and selected local files or directories. First declare and select
each local candidate with `kivro-worker import declare <draft-id> file|directory
<resource-id> <label>` and `import select`. Then set `selectedLocalPaths` in
the private package JSON to
`[{"resourceId":"...","absolutePath":"/canonical/seller/path"}]` for exactly
those selections. The Worker pins bounded regular files and their hashes to
the immutable version. It rejects symlinks, special files, path changes and
personal configuration directories. Seller paths remain on the Worker; the
buyer sees only `Selected only`. OpenClaw reads approved bytes solely through
`kivro_selected_file_read` with an opaque file ID, never a host mount. Changed
contents require a new review/version. This command does not install the package,
send data to cloud, generate test evidence or make paid execution eligible.

For a supported package, prepare a private review file with
`versionNumber`, an authoritative catalog `selectedPrice` snapshot,
`externalProcessors`, `providerEndpoint` and representative `sampleInput`
(`values` and `assets`). Set `KIVRO_OPENCLAW_APPROVED_IMAGE`,
`KIVRO_OUTPUT_COLLECTOR_IMAGE`, `KIVRO_OPENCLAW_APPROVAL_RECORD`,
`KIVRO_OPENCLAW_RUNTIME_ROOT` and `WORKER_DISCOVERY_URL` before running
`kivro-worker import review <capability-version-id> <private-review.json>`.
The file must be owned by the current user and private (0600). The command
checks the exact selected dependency set, local credential, image approval and
runtime version; runs a representative job through the real Docker,
OpenClaw and broker boundary; verifies the output contract and isolation; and
persists the tested package before sending a signed review to Kivro Cloud.
It never sends the credential or skill bytes to Cloud. If Cloud does not
acknowledge, `kivro-worker import review-retry <capability-version-id>`
recovers the already tested package and replays the same review without
paying the provider for a second representative job. The seller must still
review and approve the exact permissions, price and payout state in the Web
dashboard. Local review never publishes or authorizes paid execution by itself.

Before Web approval, run `kivro-worker import permissions <version-id>` on the
paired Worker. For an update, use `--against <current-version-id>` as shown in
the Web review. This reads the exact immutable local package and prints its
full internal permission policy, Worker tool/resource/network manifest,
selected dependency references, content hashes and new or changed access.
Only the paired device can inspect its installed packages. The output stays
local and contains references rather than secret values; it may still reveal
private resource names, so keep it out of support tickets and public logs.
The separate Web checkbox attests that the seller inspected this local view;
it is required for a new publication and does not itself install or enable a
capability. Old published approval replay keeps its original request hash.

After the seller approves publication and the exact reviewed package remains
installed, start the host-native paid supervisor with `pnpm worker:run`.
It requires the approved runtime image as the digest-pinned output collector,
`KIVRO_STORAGE_ORIGIN`, private Worker state, paired identity, and signed
control-plane discovery. Each paid offer must pass the shared admission check,
current local pause, exact version/policy review, seller credential and Docker
readiness, followed by cloud-side lease and secured-payment verification. A
missing prerequisite stops startup or reports the capability as NOT_READY;
there is no host execution fallback. The older `worker:sync-controls` command
is for zero-capacity control synchronization only.

For the macOS private alpha, install the host-native supervisor as a user
LaunchAgent after `pnpm install`, `pnpm build`, pairing, and completing the
reviewed package/image setup above. Keep `.env.local` private (`chmod 600
.env.local`); the LaunchAgent references this file by path and does not embed
its values. Run `pnpm worker:service install` and then
`pnpm worker:service start`. `pnpm worker:service status`, `logs`, `stop`, and
`uninstall` manage this user service. It restarts after login and after a
process exit, with launchd throttling. Logs are private files under
`~/.kivro/worker/logs`; the Worker writes structured error codes rather than
secret values. The service runs the same fail-closed supervisor as
`pnpm worker:run`, and never substitutes host execution for Docker. It is tied
to this checkout: after moving or replacing the checkout, stop and reinstall
the agent. The signed public-update/rollback channel remains a separate
pre-public-launch requirement; do not use a Git pull as an automatic update.
