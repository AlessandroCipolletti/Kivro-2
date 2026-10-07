# Kivro Architecture & Product Decisions

This is the durable decision log for implementation. It prevents coding
agents from silently reinterpreting settled product decisions.
`MASTER-SPEC.md` remains authoritative.

## Canonical decisions

### DEC-001 --- Kivro is runtime-independent as a brand

OpenClaw is the first supported seller runtime, not the permanent
product identity.

### DEC-002 --- Seller execution is isolated from personal OpenClaw

Paid jobs execute through the Kivro Worker in a separate minimal
OpenClaw environment. Buyers never access the seller's personal OpenClaw
session/workspace.

### DEC-003 --- Fail closed

No sandbox, incompatible runtime, critical security failure, or missing
required dependency means no paid execution. Never fall back to host
execution.

### DEC-004 --- Capabilities, not remote computer access

Buyers purchase narrow, typed, versioned capabilities. They do not
purchase arbitrary shell/browser/network access to seller machines.

### DEC-005 --- Explicit dependency consent

Every discovered skill/tool/resource/inference/network dependency must
be explicitly approved by the seller before publication.

### DEC-006 --- Controlled network access

Public research is mediated and policy-controlled.
Private/LAN/localhost/metadata access is blocked. Specialized
authenticated APIs use declared typed connectors.

### DEC-007 --- Payment before execution

No secured payment or reserved prepaid credits means no paid job
dispatch/execution. Settlement happens only after valid delivery.

### DEC-008 --- Fixed price tiers

MVP seller pricing uses Kivro-controlled fixed USD tiers with immutable
per-job price snapshots.

### DEC-009 --- Availability is independent from visibility

A capability may remain public/discoverable while scheduled offline.
Humans may schedule future execution; autonomous immediate execution
excludes future-only capabilities unless the buyer explicitly permits
waiting.

### DEC-010 --- Seller retains operational control

Seller can pause all new work and pause/cancel individual running jobs.
Local emergency pause must work without cloud connectivity and survive
restart.

### DEC-011 --- One authoritative I/O contract

The versioned capability I/O contract drives web forms, API validation,
agent mapping, Worker validation, file handling, and orchestration
compatibility.

### DEC-012 --- Versioned immutable publication

Runtime-affecting changes create a new capability version. Historical
jobs remain pinned to immutable snapshots.

### DEC-013 --- Platform inference and seller inference are separate

Kivro pays for Marketplace Agent inference. Seller capability inference
is an explicit seller dependency/cost.

### DEC-014 --- Human UI and autonomous orchestration use the same authoritative availability data

Human UI explains/schedules future availability. Autonomous immediate
mode hard-filters unavailable capabilities and continues searching
alternatives.

### DEC-015 --- UI quality is a product requirement

Kivro must use a restrained, intentional, human-designed visual system
and explicitly avoid stereotypical AI-generated SaaS aesthetics.

## Decision template

``` text
### DEC-NNN — Title
Date:
Status: Proposed | Accepted | Superseded
Context:
Decision:
Consequences:
Master Spec references:
```

Never use this log to override the Master Spec without explicit
user/product-owner approval.

### DEC-IMPL-001 --- Disable live personal-state skill listing until isolated

Date: 2026-10-06  
Status: Accepted implementation safeguard  
Context: On installed OpenClaw 2026.8.2, `skills list --json` attempted permission changes in the personal OpenClaw state during a supposed read-only scan. The local filesystem sandbox denied the writes. `OPENCLAW_CONFIG_READONLY=1` did not prevent the attempt.  
Decision: The live Kivro command allowlist contains only `--version`. Kivro uses a bounded, read-only filesystem parser behind the OpenClaw adapter for JSON5 config and `SKILL.md` frontmatter instead of stateful CLI listing. It skips symlinks and unsupported roots, never reads `.env` or secret values into discovery output, and marks uncertain inventory/readiness explicitly. It inspects the verified installed package's bundled and Custodian skill roots without executing it. Discovery never selects or authorizes a capability. Fixture byte-integrity and the adapter's read-only operations are component evidence; the live whole-tree metadata comparison is intermittent on an active installation and cannot attribute concurrent writes. M17 reopened `PRD-0010`, `WRK-0015` and `WRK-0016` pending a quiesced or independently attributed live non-mutation test. Seller-selection and effective-runtime tests also remain open.
Consequences: File-backed skill and configured-reference suggestions are available locally; authoritative Gateway inventory, effective readiness, and discovery-driven publication remain OPEN in coverage. No execution path is enabled.  
Master Spec references: §§7.2–7.4, 13.1, 57–59; DEC-002, DEC-003, DEC-005.

### DEC-IMPL-002 --- Pin OpenClaw candidate without claiming runtime support

Date: 2026-10-06  
Status: Accepted implementation safeguard  
Context: OpenClaw 2026.8.2 passed isolated Worker config syntax validation. The mandatory real sandbox execution and adversarial conformance tests have not run.  
Decision: The Worker compatibility matrix lists 2026.8.2 as a candidate only. The Worker doctor reports this status as a blocking FAIL, and unknown/missing versions also fail. No version grants paid execution until the pinned runtime, policy, and sandbox conformance evidence exists.  
Consequences: Detection and remediation are explicit without treating version parsing or config syntax as execution compatibility. Revisit the matrix when M04/M07 effective execution tests pass.  
Master Spec references: §§22, 56–59, 372; DEC-003.

### DEC-IMPL-003 --- Explicit Argon2id password policy

Date: 2026-10-06  
Status: Accepted implementation safeguard  
Context: The selected authentication library's default hash is secure scrypt, but its parameters and on-disk format are implicit in the library version.  
Decision: First-party passwords use pinned Argon2id v19 with 64 MiB memory, three passes, one lane, and independent random salts. Verification accepts only this PHC policy and rejects malformed or downgraded hashes. The shared auth options provide the hash/verify functions explicitly.  
Consequences: Password storage has an auditable versioned format and no plaintext; future parameter changes require an intentional compatibility/rehash policy. This greenfield change does not assume any production legacy accounts.  
Master Spec references: §§575, 579; AUTH-004, AUTH-017. [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

### DEC-IMPL-004 --- Explicit password setup for Google-origin accounts

Date: 2026-10-06  
Status: Accepted product policy for the conditional §577 flow  
Context: Better Auth's password recovery endpoint can issue a reset link to a verified Google-origin account with no credential identity. Leaving that behavior implicit would make the conditional `AUTH-014` policy ambiguous.  
Decision: Kivro permits a Google-origin account to add a first-party password by explicitly requesting a one-use, expiring email recovery link and setting a new password through that link. The UI explains this behavior. The flow preserves the existing canonical account ID and Google provider subject, and uses the same rate limits, private encrypted mail outbox and password hash policy as ordinary recovery.  
Consequences: The conditional policy is enabled and must be tested. A local PostgreSQL/Mailpit integration test seeds a verified Google-origin identity, requests and consumes the link, and confirms one account with both identities. Real signed Google OIDC creation/linking and account-takeover E2E remain separate open gates.  
Master Spec references: §577; AUTH-011–AUTH-014, AUTH-019.

### DEC-IMPL-005 --- Keep the full dependency graph in the Worker-local package

Date: 2026-10-06  
Status: Accepted implementation safeguard  
Context: §110 requires an immutable dependency graph snapshot for each capability version. The graph can contain seller-local resource names and credential references that are unnecessary in buyer or public cloud views. A public permission category also cannot detect a changed file ID, credential, tool or network destination between versions.  
Decision: A strict, versioned Worker-local capability package contains the full graph, internal permission policy and execution manifest. The cloud candidate carries a canonical package hash, graph hash, and sanitized projections. Candidate construction derives those fields from one validated package rather than accepting caller-supplied hashes. Seller review compares the internal security surface at reference level; changed file/credential IDs, skills, tools, resource grants, network destinations, graph nodes and inference configuration require fresh review. A later publish service must verify the stored package/hash, seller consents, security tests and payout/readiness before creating a published version.  
Consequences: The draft schema and pure diff are testable now without exposing seller-local names or claiming publication. Durable local package persistence, cloud-to-Worker hash attestation and real publish/rollback E2E remain open.  
Master Spec references: §§96, 107, 110–114, 306–311; DEC-003, DEC-SELLERUX-002, DEC-SELLERUX-006.

### DEC-IMPL-006 --- Offline Docker canary before any OpenClaw or paid execution

Date: 2026-10-06  
Status: Accepted implementation safeguard  
Context: M04 must establish a real isolation boundary before M07 can execute hostile buyer input. The installed OpenClaw version and a matching runtime image have not passed effective sandbox tests.  
Decision: The first executable sandbox adapter accepts only a platform-approved digest-pinned image and a strict offline plan. It creates an ephemeral Docker container with no network, read-only root, non-root user, no-new-privileges, seccomp, all capabilities dropped, bounded memory/CPU/PIDs/time/output, and exactly one read-only per-attempt input mount. It inspects effective Docker settings before start and removes the container on success/failure. Docker, image or policy failure blocks execution with no host fallback. A cached Alpine digest is used solely as an adversarial isolation fixture, never as proof of OpenClaw compatibility or a paid-job runtime.  
Consequences: Network/inference/resource jobs remain blocked until M06 brokers, and paid OpenClaw execution remains blocked until M07 validates a pinned compatible runtime image, package hash, Worker identity, secured payment and full file/result flow. M05 must design staging readable by the container's non-root UID without exposing seller paths.  
Master Spec references: §§16–21, 70–73; DEC-002, DEC-003, DEC-006, DEC-LOCAL-003.

### DEC-IMPL-007 --- Do not rely on Docker cp for tmpfs results

Date: 2026-10-06  
Status: Accepted implementation safeguard  
Context: M04 uses a size-bounded `/job/output` tmpfs. Real Docker experiments showed `docker cp` could not see a file written there either after container exit or while it remained running; ordinary `docker exec` inside the running container could read it. Treating a successful sandbox exit as a retrievable result would silently lose buyer deliverables. An unrestricted host bind output would lose the tmpfs byte ceiling.  
Decision: Paid result delivery remains disabled until M05 implements a bounded transfer from the isolated container to private attempt staging, validates every declared output and hash, uploads to private object storage, and M07 commits authoritative finalization. Do not substitute unbounded host bind output or claim `docker cp` provides the required transfer. The current stopped-attempt collector validates a staged fixture only.  
Consequences: The transfer mechanism needs a separately tested supervisor/stream or quota-bound volume design with descendant termination, path validation and cleanup. The M05/M07 gates remain OPEN.  
Master Spec references: §§60, 70, 211–218; DEC-003, DEC-LOCAL-003, DEC-ASYNC-001–005.

### DEC-IMPL-008 --- Bounded tmpfs volume and read-only collector for stopped output

Date: 2026-10-06  
Status: Accepted implementation safeguard  
Context: A container's own `/job/output` tmpfs is unavailable to `docker cp` after exit. A disposable Docker experiment showed that a local-driver tmpfs **volume** with explicit size, UID/GID and private mode remains readable after the job exits while a separate read-only collector container keeps it mounted. This avoids an unbounded host bind.  
Decision: M05 mounts the size-limited, non-root-owned tmpfs volume only at `/job/output` in the isolated job container and read-only in a pinned, offline collector container. The adapter inspects the effective volume/container settings before starting work. After job exit, it streams `docker cp` **from the collector**, bounds the tar stream and logical file bytes, rejects links/traversal/special entries, validates the declared result, and destroys the job, collector, volume and local staging on success or failure. Verified output is streamed to private object storage and read back for hash validation. The Worker must still wait for M07's authoritative cloud commit before any paid result is delivered or settled.  
Consequences: Docker and the collector image are mandatory prerequisites for this output profile. This local test does not prove hostile OpenClaw descendant handling, authenticated asset APIs, retention, provider deployment policy or payment finalization; those gates remain OPEN.  
Master Spec references: §§60, 70, 211–218; DEC-003, DEC-IMPL-007, DEC-ASYNC-001–005.

### DEC-IMPL-009 --- Pinned authenticated SeaweedFS for ordinary local object storage

Date: 2026-10-06  
Status: Accepted local development composition  
Context: The locally cached MinIO fixture passed the S3 adapter checks, but its registry digest was unavailable for fresh clone/CI pulls. The specification permits MinIO **or equivalent** S3-compatible local storage. An official SeaweedFS multi-platform digest is remotely pullable. Its [S3 command documentation](https://github.com/seaweedfs/seaweedfs/blob/master/weed/command/s3.go) says an absent identity configuration can allow unauthenticated access, so the local composition must supply an explicit identity file and verify denial.  
Decision: Local Compose uses `chrislusf/seaweedfs@sha256:4e61d15fd35994cb1e43e1e553dff106794841fd9a99ade2fc8c8bfce4d7872d` with a generated private static S3 identity, loopback-only published port and private named data volume. Setup creates the bucket and refuses a successful anonymous read. A real adapter test proves signed PUT/GET, checksum mismatch denial and anonymous denial. MinIO remains an extra conformance fixture, not the required fresh-clone image. Netsons/AWS still use the same provider-neutral storage port and shared asset policy.  
Consequences: This is a local development service, not a hosted storage recommendation. CI must pull the digest and run the same private-storage test. Deployment bucket policy and both-profile conformance remain OPEN.  
Master Spec references: §§218, 225–228, 555–557; DEC-LOCAL-001, DEC-LOCAL-004, DEC-ASYNC-001–005.

## DEC-LOCAL-001 --- Docker Compose local infrastructure

PostgreSQL, Redis and S3-compatible storage run locally through Docker
Compose; host installs are not required.

## DEC-LOCAL-002 --- Host-native Worker

Kivro Worker runs directly on the developer Mac during integration/E2E
development to exercise the real seller-device boundary.

## DEC-LOCAL-003 --- Real sandbox semantics locally

Development never bypasses sandboxing. Sandbox unavailable means
execution unavailable.

## DEC-LOCAL-004 --- S3-compatible local storage

Use MinIO or equivalent locally through the same storage
abstraction/business flow used for production storage.

## DEC-LOCAL-005 --- Two payment development modes

Use a deterministic fake adapter for fast tests and Stripe test mode for
Stripe acceptance; development shortcuts cannot be enabled in
production.

## DEC-LOCAL-006 --- Distinct buyer and seller identities

Even on one Mac, buyer and seller remain separate Kivro authorization
identities.

## DEC-LOCAL-007 --- Fresh-clone E2E is an engineering acceptance fixture

Maintain a reproducible buyer-to-seller local E2E path including
generated-file delivery and ledger settlement.

## DEC-AUTH-001 --- Kivro supports email/password and Google authentication

Both are MVP authentication methods and resolve to the same Kivro
user/account model.

## DEC-AUTH-002 --- Email ownership is mandatory for first-party accounts

Email/password users must verify their email before sensitive, paid,
seller, payout, or API-key actions.

## DEC-AUTH-003 --- Google login is identity-only

Google login requests only authentication identity scopes. Google Drive
or other Google product permissions are separate integrations with
separate consent.

## DEC-AUTH-004 --- Verified identities converge on one Kivro account

Kivro prevents duplicate accounts across email/password and Google when
identity can be linked safely through authoritative verified
email/provider identity. Account linking must fail closed when identity
cannot be established safely.

## Netsons production decisions

### DEC-NET-001 --- Pro Business baseline

The Netsons variant targets Pro Business because it provides the managed
Node.js, PostgreSQL, Redis, cron and developer-access capabilities
required by this profile.

### DEC-NET-002 --- No arbitrary persistent cloud daemons

Do not depend on manually started persistent daemons. Use only
hosting-managed Node applications plus cron.

### DEC-NET-003 --- PostgreSQL is the durable work queue

Jobs and asynchronous work are durable PostgreSQL state. WebSocket and
Redis are signaling/optimization layers.

### DEC-NET-004 --- No BullMQ production dependency

No persistent BullMQ consumer is required in production. Retries and
maintenance use durable PostgreSQL work plus bounded cron.

### DEC-NET-005 --- WSS remains primary Worker transport

The seller Worker uses WSS for immediate dispatch with mandatory
reconnect/reconciliation.

### DEC-NET-006 --- Minimize Node app count

Prefer one managed Node application for Web/API/WSS in the MVP unless
real Netsons testing proves another topology useful.

### DEC-NET-007 --- Durable assets use object storage

Use S3-compatible storage for durable buyer/seller assets and
direct/presigned transfers for large files.

### DEC-NET-008 --- Process restart is normal

Every cloud workflow must remain correct across managed Node process
restart.

### DEC-NET-009 --- Real Netsons staging test is mandatory

Documentation compatibility is not final acceptance; the purchased
account must pass the smoke tests and E2E.

## DEC-PORT-001 --- Worker is infrastructure-independent

The public Worker depends on the Kivro Worker Protocol and stable Kivro
discovery, never on Netsons/AWS-specific infrastructure.

## DEC-PORT-002 --- Executions retain origin ownership while draining

An execution remains owned by the control plane that leased it until
terminal state or an explicit tested transfer.

## DEC-PORT-003 --- Dual-backend coexistence is a supported continuity mode

Old backend drains owned work while new backend exclusively receives new
dispatches.

## DEC-PORT-004 --- Infrastructure location is independent from Worker upgrades

Moving Kivro Cloud normally requires neither seller reinstall, re-pair
nor binary update.

## DEC-PORT-005 --- Worker Protocol is transport-independent

Kivro Worker Protocol semantics live above connectivity. Polling and
WebSocket are adapters, not separate Worker implementations.

## DEC-PORT-006 --- Mixed transports may coexist per Worker

A single Worker may concurrently use different transport adapters for
different `controlPlaneId` values while execution ownership keeps
traffic isolated.

## DEC-PORT-007 --- Transport changes never change business semantics

Switching between polling and WebSocket cannot change authorization,
lease ownership, idempotency, payment, settlement, capability
permissions or result semantics.

## DEC-UNI-001 --- One backend core, two deployment profiles

Kivro has one shared TypeScript/Node backend implementation. Netsons and
AWS are deployment/infrastructure profiles, not separate product
backends.

## DEC-UNI-002 --- Business logic cannot live in provider adapters

Provider adapters implement infrastructure ports only.
Domain/application/API/payment/security semantics belong to shared
packages.

## DEC-UNI-003 --- Parity is enforced mechanically

Shared contracts, conformance tests, dependency-boundary checks and CI
gates are the source of parity. Human/coding-agent memory to "update
both" is insufficient.

## DEC-UNI-004 --- One public API and one logical schema

Both profiles expose the same versioned public API and use one logical
PostgreSQL schema/migration history.

## DEC-UNI-005 --- Transport differs, protocol does not

Netsons may use polling and AWS may use WebSocket, but both carry the
same Kivro Worker Protocol semantics.

## DEC-UNI-006 --- Both profiles are first-class from greenfield start

The monorepo contains and tests both deployment profiles from the
beginning even if only one profile is initially operated in production.

## DEC-UNI-007 --- Provider transition is operational

Switching ACTIVE control plane is routing/state transition between
conformant deployments of the same Kivro application, not a
rewrite/migration between independent codebases.

## DEC-HARD-001 --- Architecture rules are executable

Documentation is insufficient to preserve the
shared-core/provider-adapter boundary. CI architecture fitness tests are
mandatory merge gates.

## DEC-HARD-002 --- Behavioral parity is proven with golden scenarios

Netsons and AWS must execute the same provider-neutral golden scenarios.
Provider-specific tests are additive.

## DEC-HARD-003 --- Ambiguous failures must converge

Distributed failure handling is designed around authoritative state,
idempotency and reconciliation. Fault injection must prove final
convergence and exactly-once financial effects.

## DEC-HARD-004 --- Compatibility is explicit and multi-dimensional

Cloud, Worker, protocol, API, schema and manifest versions are tracked
independently with declared compatibility ranges.

## DEC-HARD-005 --- Database rollout uses expand/deploy/contract

Schema changes must tolerate overlapping compatible cloud
releases/control planes and resumable backfills.

## DEC-HARD-006 --- Worker updates are signed and independent from provider switches

Infrastructure routing changes do not force binary updates. Actual
Worker releases use verified signed artifacts and staged/recoverable
rollout practices.

## DEC-HARD-007 --- Backups require restore evidence

Configured backups are not sufficient evidence of disaster recovery;
isolated restore tests and invariant checks are required.

## DEC-HARD-008 --- Releases are unified

Netsons and AWS deploy the same Kivro product release with profile
adapter revisions recorded in one machine-readable release manifest.

## DEC-ASYNC-001 --- Jobs outlive browser sessions

Browser connections are not part of job correctness.

## DEC-ASYNC-002 --- Kivro owns durable buyer delivery

Seller-local success is not buyer completion; Kivro finalizes outputs
before `COMPLETED`.

## DEC-ASYNC-003 --- Binary results use private object storage

PostgreSQL owns identity/state/metadata; private object storage owns
durable binaries.

## DEC-ASYNC-004 --- Retrieval is re-authorized

Download access is short-lived and regenerated only after authorization.

## DEC-ASYNC-005 --- Retention is shared product policy

Both provider adapters implement identical logical retention/cleanup
semantics.

## DEC-ASYNC-006 --- Notifications are advisory

Email/webhook failure never changes an authoritative completed result.

## DEC-BUYERUX-001 --- Buyer predictability is a Core contract

Quote, deadline, cancellation, wait/expiry, progress, results and
privacy semantics belong to shared Kivro Core, not deployment adapters.

## DEC-BUYERUX-002 --- Estimates are evidence-based, not promises by default

Kivro prefers ranges/unknown over false precision and distinguishes
estimates from explicit guarantees.

## DEC-BUYERUX-003 --- No indefinite paid waiting

Every queued/scheduled paid job has bounded waiting/start-expiry
semantics and a deterministic release/refund path.

## DEC-BUYERUX-004 --- Historical jobs are immutable evidence

Input and capability/purchase snapshots explain exactly what was
authorized and executed; reruns create new jobs.

## DEC-BUYERUX-005 --- Seller receives minimum buyer identity

Worker jobs are pseudonymous by default; identity/profile/payment data
is withheld unless explicitly required and disclosed.

## DEC-BUYERUX-006 --- Result UX is semantic

Kivro uses versioned output contracts for named deliverables, previews
and safe bulk download instead of treating every result as opaque files.

## DEC-BUYERUX-007 --- Problem reporting is not implicit escrow

Buyer acknowledgement/problem reporting is durable support evidence;
financial remediation follows explicit audited policy.

## DEC-SELLERUX-001 --- Safe seller complexity is translated, not removed

Kivro keeps strict machine policy while presenting guided human
decisions.

## DEC-SELLERUX-002 --- Discovery is never consent

Local discovery is read-only/suggestion-only; exposure always requires
explicit seller selection.

## DEC-SELLERUX-003 --- AI assists but cannot authorize

AI may draft capability configuration but deterministic policy plus
seller consent controls permissions, secrets, pricing and publication.

## DEC-SELLERUX-004 --- Profit protection is product behavior

Seller-funded provider cost visibility/guardrails are part of safe
selling, not optional analytics.

## DEC-SELLERUX-005 --- Operational health is explainable

Unavailable/auto-paused states expose deterministic reasons and
remediation.

## DEC-SELLERUX-006 --- Published versions and historical jobs remain immutable

Rollback changes eligibility for new jobs only.

## DEC-SELLERUX-007 --- Marketplace identity and KYC identity are separate concerns

Public display identity does not automatically expose private legal
payout identity.

## DEC-SELLERUX-008 --- Seller is not structurally one machine

Core schema/contracts support explicit Worker identity/assignment from
greenfield.

### DEC-IMPL-010 --- Cloud-owned public research with pinned destination and private-data barrier

Date: 2026-10-06
Status: Accepted implementation boundary
Context: M06 needs useful public search/fetch without turning the seller machine into an unrestricted network proxy. Cloud publication and authenticated Worker routing arrive in M07. A URL check before an independent socket connection would allow DNS rebinding and redirect bypasses. GET query strings can also carry private data.
Decision: Shared Core owns the versioned public-research policy, broker semantics and durable budget/audit ports. A replaceable HTTP adapter resolves every hop, rejects mixed/private answers and pins the vetted public IP at socket creation with the original TLS host. Generic search uses a platform credential; private DB access uses a separate named-operation, dedicated-role adapter. An authoritative per-job private-resource-read flag blocks subsequent public research calls. The published/job contract carries a sanitized immutable public-research policy snapshot so cloud egress can enforce its exact ceilings. The existing Docker job profile stays `network=none`; M07 must provide an authenticated, job-bound broker route and must not give the sandbox raw Internet.
Consequences: Broker unit, PostgreSQL race and one bounded public HTTPS smoke pass. Live Brave search, declared-service/provider credentials, seller/buyer UI, noexec download staging, full OpenClaw prompt-injection/data-flow tests and both deployment roots remain `DEFERRED_VERIFICATION`. The private-read barrier reduces one exfiltration route; it does not prove arbitrary model knowledge or seller skill contents cannot be encoded into a GET query. No network-enabled paid capability is eligible to run yet.
Master Spec references: §§14, 16, 71–73, 237–277; DEC-003–DEC-006.

### DEC-IMPL-011 --- Durable paid-job leases and truthful per-job pause state

Date: 2026-10-06
Status: Accepted implementation boundary
Context: M07 must survive cloud restart and duplicate Worker messages without letting a claimed heartbeat, offer flag, or local pause button determine financial truth. A random lease token stored only as a hash could not be reconstructed for a still-pending offer after restart. Docker's normal wall-clock timeout would also expire while a job is locally paused.
Decision: Shared PostgreSQL transactions own one active attempt, immutable job/input/result snapshots, transition IDs, control-plane ownership and private-output finalization. Paid dispatch and every execution transition call a mandatory trusted reservation verifier; until M08 provides the ledger adapter, production paid execution remains closed. A versioned HMAC derives the lease token from immutable execution/Worker/control-plane identity; only its hash is stored. Rotations retain old key versions until their leases end. Worker reconnect decisions are recomputed from database lease/payment/job state, never from a Worker claim alone. The local Worker persists per-job pause commands before acting, confirms Docker's effective container state before acknowledging PAUSED, excludes confirmed pause time from the offline sandbox's active runtime budget, and stops an offline container after its lease expires. A Worker control failure is audited while the cloud stays in PAUSE_REQUESTED or RESUME_REQUESTED; it cannot assert a prior execution state without verified local state. Accepted-job cancellation cannot be recorded as CANCELLED by cloud intent alone.
The shared Worker Protocol defines messages and transport ownership; Netsons hosts the initial HTTPS polling mechanics behind that interface. A later AWS WebSocket adapter must implement the same protocol without changing job semantics or re-pairing the device.
Consequences at the initial M07 checkpoint: PostgreSQL, SQLite and real Docker tests covered restart, replay, competing offers, pause/resume, output finalization and expired-payment stop, while the candidate OpenClaw image had only a version probe. `DEC-IMPL-012` records the subsequent pinned job execution, broker route, effective mode-all policy and exact local image approval. The authenticated live cloud route, M08 ledger, graphical controls, both provider roots and paid E2E remain open. A paused offline container must be unpaused immediately before Docker can kill it; the implemented brokered profile revokes new grants and quiesces in-flight calls before that operation.
Master Spec references: §§9–15, 426–450; DEC-ASYNC-001–006; DEC-PORT-001–007.

### DEC-IMPL-012 --- Pinned OpenClaw execution uses a verified contained sandbox backend

Date: 2026-10-06
Status: Accepted M07 implementation boundary
Context: OpenClaw 2026.8.2's `sandbox.mode=all` with its stock Docker backend attempts to create a second container. The Kivro per-job container deliberately has no seller Docker socket, network route or privilege to do that; the real test failed closed with Docker unavailable. Disabling OpenClaw sandbox mode would violate Master Spec §59. Giving the job container a host Docker socket would violate the stronger per-job isolation boundary.
Decision: The Worker creates and inspects one digest-approved, network-none, read-only, non-root per-job Docker container before OpenClaw starts. The pinned image preloads the Kivro tool plugin in the same OpenClaw CLI module graph and registers `kivro-contained` as a real OpenClaw sandbox backend. The backend is available only inside the verified job container after the Worker loopback bridge is ready, requires `mode=all`, a pinned image, no workspace mounts, dropped capabilities and non-root UID, and refuses arbitrary shell operations. The generated config disables elevated execution and exposes only seller-selected Kivro tools. Before `agent exec`, the runner checks OpenClaw's own effective `sandbox explain --json` report for mode, backend, mount set, workspace access, elevation and exact tool allowlist. The Worker still independently checks the effective Docker configuration and the exact image approval record before accepting a paid offer. A source change or image digest change invalidates approval until the full real execution suite passes again.
Rationale: This preserves the mandatory OpenClaw `mode=all` policy while using the already verified per-job container as the approved backend. It does not expose the Docker socket or rely on OpenClaw defaults. The plugin's allowed file and broker tools execute inside the same container; model-initiated shell/host execution is denied. The personal OpenClaw state is never mounted or modified.
Evidence: `pnpm test:openclaw:execution` exercises pinned OpenClaw agent execution, effective policy, real file read/write, sidecar routing, host-file/private-network denial, in-flight inference pause and Worker supervisor finalization. `pnpm openclaw:approve-local-image` writes a private exact-digest approval only after that suite passes. Unit and PostgreSQL tests cover image-source drift, admission, lease/payment-gated accepted input, local command audit and result outbox.
Remaining gates: M08 authoritative ledger, M13 authenticated deployed job endpoints, M12/M14 seller controls, M16 paid buyer-to-Worker E2E, M19 both provider roots and M26/M29 crash/restart fault cases remain open with exact tests in the verification backlog. The local approval does not authorize paid execution in the absence of the ledger verifier.
Master Spec references: §§15, 20–22, 58–60, 426–450; DEC-IMPL-011.

### DEC-IMPL-013 --- Prepaid credit authorization and independently reconciled seller economics

Date: 2026-10-06
Status: Accepted M08 implementation boundary
Context: M07 deliberately denied paid execution without an authoritative financial verifier. A Worker completion, browser redirect, Stripe webhook arrival, mutable balance field, or Connect return URL cannot establish financial truth. Credits must survive duplicate requests, process failure, provider event reordering, and delayed seller payout without double effects.
Decision: The initial paid flow uses USD prepaid Credits. PostgreSQL owns immutable balanced journal entries, buyer available/reserved accounts, job-bound reservations, and separate job/payment states. Reservation and job eligibility change in one transaction. Every M07 paid dispatch/claim/execution transition rechecks the exact reservation journal, state, buyer, price snapshot, billing and recently reconciled Connect prerequisites. Settlement follows only cloud-validated durable result finalization; seller pending earnings mature after seven days before an idempotent Stripe Connect transfer. Payout observation is a separate provider state. The platform retains the exact fixed-tier fee and absorbs actual Stripe processing fees. Job credits are fully restored on eligible failure, cancellation or administrative refund using compensating entries; after an irreversible paid seller payout, an administrative full refund records platform loss without rewriting history. Card refunds/disputes freeze the buyer and use provider-object reconciliation, including out-of-order events. Seller provider spend is external to the fixed marketplace split and is labeled measured, estimated or unknown. Limits bind to the seller's immutable job policy, not buyer arguments.
The Stripe adapter is server-only, pins an API version, separates test/live mode, sends stable idempotency keys, verifies raw webhook signatures, persists the event before processing, and polls current PaymentIntent, refund, Connect and payout objects before applying effects. An authenticated cron route invokes bounded reconciliation, but deployment scheduling and a real Stripe test account remain later acceptance dependencies. Merchant-of-record, taxes, stored-credit terms and dispute liability require legal/accounting review before public launch. The §24.25 P5 direct per-job authorization/capture option remains an explicit open future implementation requirement; the MVP does not claim it is verified.
Evidence: `tests/m08-finance-postgres-integration.mjs`, `tests/finance-policy.test.mjs`, `tests/stripe-webhook.test.mjs`, `tests/stripe-gateway.test.mjs`, `tests/seller-economics.test.mjs`, and `tests/openclaw-tool-budget.test.mjs` exercise transactional, provider-adapter and seller-cost boundaries. `docs/verification-backlog.md` holds the remaining full-system gates.
Master Spec references: §§24–25, 278–298; DEC-BUYERUX-003, DEC-SELLERUX-004, DEC-IMPL-011–012.

### DEC-IMPL-014 --- Seller-local scheduling is Core-owned and credit admission is atomic

Date: 2026-10-07
Status: Accepted M09 implementation boundary
Context: A closed seller schedule cannot be treated as capability invisibility. A previously accepted future reservation must survive a later Worker outage, and immediate paid work must not begin outside a seller-approved window. Seller edits, Worker sleep, DST changes, queue races and control-plane restarts must preserve the original buyer deadline and financial truth. An already purchased job must retain its immutable published version after a later capability publication.
Decision: Shared Core owns strict IANA weekly schedules, Worker defaults and capability overrides, seller/platform pause, short-lived schedule quotes, deterministic accepted-order queue priority, conservative per-window and shared-Worker future workload limits, and a PostgreSQL schedule plan. Schedule membership is computed from UTC instants in the seller's local wall-clock zone; skipped spring minutes never exist and repeated fall minutes are both eligible. A quote states earliest eligibility, never a guaranteed start. A new scheduled reservation requires healthy current Worker/readiness at quote and confirmation; an already reserved job waits through later Worker offline periods until its immutable deadline. Booking locks capability policy and Worker capacity and atomically commits both the M08 credit reservation and immutable job scheduling terms. Booking may precede buyer input upload, but M07 refuses an offer until the finalized input manifest exists, and an inputless earlier job does not starve a ready buyer. Missing input expires at the original latest start with full credit release. Input finalization remains allowed only before offer and immutable afterward. A seller edit invalidates projections across affected Worker/capability jobs; new purchase fails closed until the durable scheduler reprojects them. M07 independently owns offers, leases and execution transitions; it checks M09 eligibility at offer, acceptance, input release and STARTING. A Worker heartbeat is authenticated, timestamp-monotonic and version/policy-hash-bound; missing or stale readiness fails closed. Accepted jobs use their pinned published version and Worker, even after a new version becomes current. A bounded host-native scheduler recomputes next eligibility and expires/releases jobs from PostgreSQL after restart. Seller edits atomically invalidate prior reconciliation so older accepted jobs retain priority; running work remains governed by its existing M07 lease.
Consequences: M09 Core can authorize paid scheduled execution only after M07 and M08 both agree. Buyer/seller UI, REST/Agent consumers, outbound notifications, Netsons/AWS scheduler deployment and physical sleep fault tests remain open with exact closing evidence in `docs/verification-backlog.md`. The optional stricter queued-job mode mentioned for later in §408 is not the MVP default; queued work rolls to the next valid window before its immutable latest start. No browser session is a job lifetime boundary.
Evidence: `tests/m09-postgres-integration.mjs`, `tests/availability-schedule.test.mjs`, `tests/availability-reporter.test.mjs`, `tests/availability-scheduler-loop.test.mjs`, `tests/scheduled-job-metrics.test.mjs`; M07/M08 PostgreSQL and real Docker/OpenClaw regression suites.
Master Spec references: §26, §§396–425, §§451–487; DEC-IMPL-011–013.

### DEC-IMPL-015 --- Buyer marketplace reads current Core terms and records verified social evidence

Date: 2026-10-07
Status: Accepted M10 implementation boundary
Context: Public marketplace cards can become misleading when a seller edits price, changes availability or republishes a capability. Buyer uploads, example assets and result files cross several privacy boundaries. A browser retry after a successful PostgreSQL commit can accidentally create a second paid job if each click uses new IDs. Reviews and usage statistics must reflect completed paid work rather than seller claims.
Decision: Shared Core/PostgreSQL projections provide public current-version catalog, price, M09 availability, observed completed-job usage and settled-job reviews. Missing runtime/rating evidence is shown as unknown; median runtime appears only after five completed observations. PUBLIC supply enters search and typed discovery documents; UNLISTED is direct-link only and PRIVATE requires a buyer grant. Examples are explicitly seller-approved, contract-valid and version-bound, with private or seller-local asset references excluded. The web layer renders buyer/seller text and Markdown as untrusted content and authorizes every private output download using the current buyer session and retention state. Buyer uploads use a short-lived, exact-object signed URL to a private staging key with incremental browser hashing; Core validates the staged object, copies it within storage to a distinct final key, validates that final object and only then marks the input READY. A still-valid signed URL cannot overwrite the final job input. M09 booking and late input finalization extend object/grant retention atomically through the immutable latest start and runtime; the grant trigger permits only active scheduled, one-way extensions. Buyer preflight uses the Core quote, and M09 booking revalidates it while reserving M08 Credits. Browser purchase attempts retain stable job/reservation/manifest IDs and probe that exact job after a lost response. Run Again reuses only permitted input values, obtains a new current-version quote and shows the current price with a version/permission change warning. One review requires a settled completed job, with ownership and self-review checks; edits retain immutable revisions.
Consequences: M10 can safely supply typed public discovery primitives to M11 without granting AI spending authority or leaking seller-private metadata. Seller example authoring/Test Playground remains M14 work. Authenticated Worker transport, complete paid result/file E2E, deployed Stripe checkout, notification delivery and both-provider conformance retain exact open gates in `docs/verification-backlog.md`. Browser and PostgreSQL tests prove the M10-owned buyer journey, not those later journeys.
Evidence: `tests/m10-postgres-integration.mjs`, `tests/browser-m10/marketplace.spec.ts`, `docs/milestones/M10.md`.
Master Spec references: §§28–29, §§120–161, §§356–368; DEC-BUYERUX-001–007, DEC-IMPL-011–014.

### DEC-IMPL-016 --- Platform inference is advisory and plan purchase authority remains in Core

Date: 2026-10-07
Status: Accepted M11 implementation boundary
Context: Marketplace text, model output and provider responses are untrusted, while plans can reserve buyer credits and grant a downstream Worker access to private upstream artifacts. Provider availability and pricing also change independently of published capabilities. The Master Spec's §149 tool list describes internal service responsibilities, while §§147–148 forbid model-controlled financial actions.
Decision: Shared Core constructs and validates one ordered, immutable buyer-review plan at a time. The planner's step-building loop is atomic instead of exposing an independently mutable persisted `add_plan_step` operation. Buyer-visible plan review requests explicit approval; the server-only Purchase Authorization Service executes eligible steps after that approval. Model-exposed tools are a smaller allowlist of read-only public capability, review, availability and contract lookups; the strict internal executor also offers catalog search, quotes, drafts, full-plan creation/validation and buyer-scoped result reads. The model cannot call approval or money-moving operations. PAS re-quotes every step, checks immutable price/version/permission and the approved ceiling, then uses M08/M09 credit booking and M07 job authority. Missing or changed facts pause the plan and require a new immutable revision and buyer approval. Platform inference credentials and usage stay in the server-side provider adapter/accounting path; seller Worker inference and costs stay separate. Unknown provider cost is recorded as unknown, not zero. Discovery scans public supply to a bounded operational limit and returns an error, never a false no-match, if that limit is reached. A missing trustworthy queue ETA excludes Busy supply from immediate autonomous purchase rather than inventing a short wait.
Consequences: M11 can compose paid jobs and private result references without a parallel payment, job or availability system. Full §160 real staging, live third-party provider contracts, production secret stores, operator dashboard and deployed billing separation remain open with exact closing tests in `docs/verification-backlog.md`. The earlier direct user instruction to populate `.env.example` with safe sample values/comments supersedes §166's names-only example wording for that file alone; `SEC-0069` is recorded as `USER_OVERRIDE`, never as a verified original criterion.
Evidence: `tests/m11-agent.test.mjs`, `tests/m11-postgres-integration.mjs`, `tests/browser-m10/marketplace.spec.ts`, `docs/milestones/M11.md`.
Master Spec references: §§129–191, §§488–517; DEC-007, DEC-009, DEC-011, DEC-013–014, DEC-IMPL-011–015.

### DEC-IMPL-017 --- Seller controls are independent authorities with readiness-gated release

Date: 2026-10-07
Status: Accepted M12 implementation boundary
Context: A web pause can be set while the Worker is offline, and a local seller pause must survive cloud failure and restart. Either side clearing the other's stop would permit an unsafe paid offer. A critical sandbox or Worker-version finding must also remain latched after a seller clicks Resume. M07's optional heartbeat reporter could otherwise admit an offer based on an older cloud observation.
Decision: Shared PostgreSQL Core owns seller web pause, capability pause, maintenance deadline, schedule, signed Worker reports, health TTL and append-only operational events. The Worker owns a private synchronous SQLite local stop, capability stop and security latch. Cloud and local pause revisions are separate and monotonic. Every signed poll returns the current cloud directive before any offer; the Worker applies it before considering execution. The control-only host-native sync process reports zero execution capacity until the M13 authenticated full job RPC composition exists. M07's dispatch loop now requires a same-cycle acknowledged readiness report for the exact capability version, positive capacity and a current local unpaused decision before accepting an offer. CLI health reports that control-only mode cannot receive paid work.
Security blocks are separate from seller pauses. A seller resume cannot clear them. An internal platform-only clear operation requires a fresh signed healthy Worker observation, acceptable release, healthy Docker/approved image/identity checks and ready published capabilities; it increments the cloud revision and sends an explicit clear directive. That directive can release only a cloud-origin security latch, never an independent local security finding. M12 provides no seller HTTP route for platform clearance; the authenticated operator surface belongs to M15. A maintenance deadline is a revalidation trigger, not an unconditional auto-resume: the scheduler keeps the capability or Worker paused if health or security is not ready. RESTART_STEP remains a known future protocol mode, but candidate publication refuses to promise it until a durable checkpoint runtime exists.
Evidence: M12 SQLite/CLI, signed transport, PostgreSQL, seller browser and real Docker tests cover offline pause, replay, stale heartbeat, security block/clear, maintenance, health history, local control reports, paid pause expiry and idempotent financial release. M07–M11 PostgreSQL and M10 browser regressions pass. `spec/COVERAGE.md` and `docs/verification-backlog.md` retain full paid, provider, physical sleep/reboot and fault gates until their actual dependencies exist.
Master Spec references: §§369–450; DEC-IMPL-011, DEC-IMPL-013–016.

### DEC-IMPL-018 --- Buyer credentials and webhook delivery are cloud-owned; paid Worker RPC remains lease-bound

Date: 2026-10-07
Status: Accepted M13 implementation boundary
Context: Buyer API retries can arrive after a credit reservation succeeded but before the HTTP response was stored. Webhook destinations can rebind after registration, and delivery acknowledgement may be lost after a successful send. M12's control-only Worker deliberately advertises zero paid capacity; adding REST routes must not accidentally turn a buyer credential into Worker authority.
Decision: Buyer keys and Worker device signatures are separate credential classes. Buyer keys are high-entropy opaque secrets with only SHA-256 hashes retained, scoped and rate-limited per key/account/endpoint. One account-wide idempotency key and canonical request fingerprint persist stable quote, job, reservation and input-manifest IDs for 30 days; retry after lease expiry re-enters the same Core booking operation. The accepted-quote recovery branch reads the immutable job and does not re-finalize one-way input grants. The signed Worker job RPC endpoints authenticate the device and plane, then call M07 execution and M08 financial services; Worker data cannot authorize its own payment, choose result retention or settle earnings. Failed terminal transitions and validated durable completion drive idempotent release/settlement, with the existing financial reconciler repairing a crash between the two operations. These server routes do not change the M12 host-native control-only process or advertise capacity before a complete local supervisor composition is ready.
Webhook endpoint secrets are AES-GCM encrypted with endpoint-bound associated data. Job-transition transactions create immutable event/outbox rows. Delivery re-resolves every destination, rejects all mixed/private/metadata answers, pins the vetted public IP to a direct TLS socket with the original host for certificate verification, and never follows redirects. Production requires an explicit denylist of current and draining control-plane hostnames in addition to the application and Worker-discovery origins; absent configuration fails closed. A leased delivery does not consume a retry until an actual outcome is committed. A crash after send may repeat the same immutable event ID; consumers verify HMAC over timestamp and raw body and deduplicate that ID. Only concise event metadata leaves Kivro; result assets require buyer authorization. The webhook dispatcher runs cloud-side, never on the seller Worker.
Evidence: `tests/m13-webhook-policy.test.mjs`, `tests/m13-postgres-integration.mjs`, `tests/browser-m13/buyer-integrations.spec.ts`, `docs/API-v1.md`. Earlier M07/M10 correctness repairs to Worker scope error reporting and accepted-job/file-grant retries are covered by M13 and regression tests. Remaining real paid Worker/OpenClaw E2E, host supervisor production composition, physical restart/sleep and both provider roots stay open in the verification backlog; no part of the M13 REST or webhook path treats their partial evidence as full acceptance.
Master Spec references: §§319–356, §406, §§420–421; DEC-IMPL-011, DEC-IMPL-013–017.

### DEC-IMPL-019 --- Availability time is observed, with gaps explicit

Date: 2026-10-07
Status: Accepted M13 implementation boundary
Context: §354 asks for online, offline and busy time, but M09's job/schedule events do not form a continuous capability-state timeline. Treating heartbeat gaps as measured uptime would invent precision and could unfairly penalize laptop-based sellers.
Decision: The durable scheduler samples the authoritative seller-visible capability state once per minute. Immutable observations count only sampled minutes; missing periods remain explicitly unknown. Queue-full rejections are recorded once per attempted quote ID, while accepted jobs, median queue wait/execution and disconnect failures derive from authoritative job transitions and plans. The 30-day seller projection shows these metrics with their source and uncertainty. Marketplace ranking does not consume uptime observations or apply an uptime penalty. Later ranking policy may use metrics only after a separate explicit product decision and sufficient data.
Evidence: `packages/persistence/migrations/0024_availability_metrics.sql`, `packages/persistence/src/availability-metrics.ts`, `tools/kivro-scheduler.mjs`, `tests/m13-postgres-integration.mjs` and `tests/browser-m12/seller-operations.spec.ts`.
Master Spec reference: §354.

### DEC-IMPL-020 --- One restrained visual system across existing buyer and seller surfaces

Date: 2026-10-07
Status: Accepted M14 presentation boundary
Context: M10–M13 pages had separate navigation, dense technical blocks and mobile capability detail placed price and the action after long explanatory sections. These made authoritative Core data harder to scan, particularly on mobile.
Decision: Shared Kivro tokens, one sans stack, a small stroke-icon family and one responsive header govern the existing web surfaces. Buyer price, availability and the next action appear near capability identity on mobile; the seller Worker and safety controls lead the dashboard. Exact permission rows and operational diagnostics use labeled native disclosure while the human-readable summary stays visible. Status text accompanies every semantic color. Interaction and financial authority stay in existing Core/application services; CSS or display copies never create a separate commercial state. Captured browser screenshots and responsive/keyboard assertions are the design review evidence.
Rationale: Master §§518–550 prioritize hierarchy, clarity and restraint. Native disclosure and consistent tokens reduce visual noise without hiding information needed for a purchase or safety decision. The existing missing seller authoring/publication service is not represented as a working publish action; its prior implementation gates remain open.
Evidence: `docs/design-system.md`, `apps/web/app/design-system.css`, `apps/web/app/ui`, `tests/browser-m10/design-system.spec.ts`, `tests/browser-m10/marketplace.spec.ts`, `tests/browser-m12/seller-operations.spec.ts`, `tests/browser-m13/buyer-integrations.spec.ts` and the M14 visual review record.
Master Spec references: §§518–550; DEC-015.

### DEC-IMPL-021 --- Operational controls stay in Core; file delivery needs a cloud-owned clean copy

Date: 2026-10-07
Status: Accepted M15 component boundary; seller publication remains open implementation
Context: Abuse responses must stop an already-offered job before acceptance or start, while a Worker must not turn an arbitrary private object or its own metadata into a delivered result. Monitoring must not copy raw buyer content into a central log. A signed upload URL can remain usable after the first cloud read, so scanning the staging object alone would allow a later overwrite race.
Decision: An explicitly granted operator can revise a single PostgreSQL dispatch control row and suspend accounts/capabilities or revoke devices. Offer, acceptance and start lock and inspect the same authoritative controls; quote and booking count durable attempts and apply account spend/frequency limits before financial reservation. Reports and operator actions use bounded categories and append-only coded events. The Worker requests a short-lived upload intent bound to its live job, attempt, device, control plane, lease and declared output field. Cloud copies that staging object to a new private key the Worker never receives, then checks bytes, type and ClamAV verdict on the copy before M07 completion and M08 settlement. Scanner absence fails closed. Staging cleanup waits beyond the last signed PUT expiry. External-processor declarations are versioned; external access requires a nonempty declaration and unknown declarations block new paid booking. Seller authoring/publication is not yet complete, so supply-chain and seller-declaration requirements remain OPEN_IMPLEMENTATION.
Evidence: `tests/m15-postgres-integration.mjs`, `tests/m07-result-postgres-integration.mjs`, `tests/m13-postgres-integration.mjs`, `tests/m15-result-safety.test.mjs`, `tests/m15-clamav-live.test.mjs`, `tests/m15-health-live.test.mjs`, `tests/browser-m10/marketplace.spec.ts`; `docs/milestones/M15.md` records the remaining implementation and cross-milestone gates. A prior M13 migration lacked transaction wrapping and was corrected so forward-only local migrations reach M15.
Master Spec references: §§29–38, §84; DEC-IMPL-011–020.

### DEC-IMPL-022 --- Rollback and visibility retain independent safety gates

Date: 2026-10-07
Status: Accepted M14 component decision; full seller publication and paid execution evidence remain open
Context: Master §§309–318 permit rollback to an immutable historical version and separate PRIVATE/UNLISTED/PUBLIC visibility from runtime availability. A previous version can be incompatible with current Worker dependencies, and an earlier ready payout can become disabled. Private grants can outlive a visibility change if they are merely hidden.
Decision: The Core transaction locks the capability and seller, checks the expected active version, validates a fresh signed exact-version Worker readiness report and current Stripe Connect payout eligibility, then switches the immutable active pointer. The capability starts paused; existing jobs and snapshots are untouched. Visibility transitions are seller-session authorized, compare-and-swap and append-only audited. A transition to PUBLIC requires fresh readiness and current payout eligibility. Leaving PRIVATE revokes active grants transactionally; returning to PRIVATE requires explicit new grants. A grant requires a distinct verified buyer account and does not bypass payment.
Evidence: `packages/persistence/src/seller-publication.ts`, migrations `0027_capability_rollback.sql` and `0028_seller_visibility.sql`, `tests/m14-publication-postgres-integration.mjs`, `tests/browser-m12/seller-operations.spec.ts`, and rendered screenshots in `docs/evidence/m14/`. These tests use seeded readiness and synthetic publication review; real Worker-generated review and paid two-account execution remain open in the verification backlog.
Master Spec references: §§309–318; DEC-IMPL-020.

### DEC-IMPL-023 --- Seller review is durable, and paid Worker admission is local plus cloud authoritative

Date: 2026-10-07
Status: Accepted implementation decision; full paid seller/buyer E2E remains open
Context: A representative seller test can spend provider credit and then lose its cloud acknowledgement. Repeating the test on retry changes evidence and cost. A published capability must not inherit readiness from a stale local image, missing credential, changed skill, paused Worker or unverified provider endpoint. A transport message ID or control-plane ID must not make identical tested content appear changed during backend transition.
Decision: The Worker stores selected skill bytes in an immutable private unreviewed package, runs the exact package through pinned Docker/OpenClaw and broker isolation, and records the resulting review before installation or network send. Restart replay reconstructs the deterministic reviewed package from the original immutable staged bytes and checks its hash against the persisted review. The provider endpoint is private local configuration bound to the outbox entry; it never enters the public capability snapshot. Cloud hashes the review's tested content independently of transport message and control-plane IDs, while each envelope still authenticates its actual plane and device. The host-native `worker:run` composes shared dispatch and execution services with signed job RPC. A paid offer is rejected unless the exact acknowledged review, package, selected skill bytes, current provider credential and public DNS, approved OpenClaw/collector image, capacity and local pause state are ready. Cloud acceptance independently rechecks the specific lease, payment reservation and scheduling state. The output collector uses the same approved digest until a separate collector approval pipeline exists; Docker's config image ID is not confused with the repository manifest digest. A heartbeat may list an installed reviewed version before seller publication; Cloud ignores its readiness until that immutable version is published, while still processing health for published versions. Seller inference remains under local cost reservations. A failed prerequisite never falls back to personal OpenClaw or host execution.
Evidence: `apps/worker/src/import-review-command.ts`, `apps/worker/src/execution-runtime.ts`, `apps/worker/src/runtime-readiness.ts`, `packages/persistence/src/seller-publication.ts`, `tests/import-review-outbox.test.mjs`, `tests/worker-runtime-readiness.test.mjs`, `tests/docker-worker-supervisor-local-integration.mjs` and `tests/m14-publication-postgres-integration.mjs`. The M16 Core/Worker Docker slice is still synthetic in its provider and publication setup; a complete installed seller and Stripe buyer E2E is open in the verification backlog.
Master Spec references: §111, §§309–318, §§518–550; DEC-IMPL-011–013, DEC-IMPL-020–022.

### DEC-IMPL-024 --- Version changes require a fresh seller review

Date: 2026-10-07
Status: Accepted M14 component decision; exact local policy inspection remains open
Context: The publication screen originally showed only the candidate. A seller approving a later version could miss a price, contract, dependency or permission change, even though all dependency checkboxes were checked.
Decision: Shared Core compares the candidate with the current immutable published snapshot and returns an explicit seller-facing change list. It names price split, input/output contract, public access category, Worker manifest, dependency snapshot, external processors and inference changes. A changed opaque permission-policy hash is always identified as requiring exact local access review; the public category summary is never represented as a complete policy diff. The seller must separately acknowledge changes for a subsequent version, and the PostgreSQL publication transaction refuses a later version without that explicit acknowledgement. First-version approvals retain their prior schema/hash for replay compatibility.
Evidence: `packages/domain/src/capability-version.ts`, `packages/persistence/src/seller-publication.ts`, `apps/web/app/seller/seller-publication.tsx`, `tests/capability-version.test.mjs`, `tests/m14-publication-postgres-integration.mjs`, and the M12 seller browser screenshot of the 390px prepublication diff. Full exact local policy expansion and authentic paid seller E2E remain open.
Master Spec references: §§111–113, §§309–318, §§531–550; DEC-IMPL-022–023.

### DEC-IMPL-025 --- Exact local permission inspection precedes cloud publication

Date: 2026-10-07
Status: Accepted M14 component decision; authentic seller paid E2E remains open
Context: The cloud deliberately holds only public permission categories, hashes and bounded dependency labels. A Web-only version comparison cannot show the seller's private resource, credential, tool and network references. Treating the coarse categories as an exact policy review would mislead the seller.
Decision: The paired Worker reads its immutable reviewed package and displays the full internal policy, manifest, selected dependency references and exact expansion against a prior local version with `import permissions`. The Web review includes the version-specific command and a separate acknowledgement. Shared PostgreSQL publication rejects new approvals without that acknowledgement, while already published requests retain their prior idempotency hash on replay. The cloud never receives the full local policy or credential values. A missing old package prevents a same-Worker exact comparison rather than manufacturing a diff.
Evidence: `apps/worker/src/import-permission-review.ts`, `apps/worker/src/cli.ts`, `packages/persistence/src/seller-publication.ts`, `tests/worker-package-store.test.mjs`, `tests/m14-publication-postgres-integration.mjs` and `tests/browser-m12/seller-operations.spec.ts`. These prove the inspection and consent components. They do not prove that a real seller performed the full publication and paid execution journey.
Master Spec references: §§75–77, §111, §§309–318, §§531–550; DEC-IMPL-024.
