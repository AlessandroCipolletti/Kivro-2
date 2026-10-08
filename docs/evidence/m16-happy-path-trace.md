# Master Spec §88: 44-step trace at M16

This is an audit of the original sequence, not a claim that its complete
acceptance gate has passed. `DIRECT` means the installed development-credit
path in `tests/m16-installed-worker-e2e.mjs` observes the step. `SEPARATE`
means a production path and test exist, but not in that same run. `OPEN` needs
an external service, a later milestone, or additional authentic integration.

| Step | Required action | Current evidence |
| --- | --- | --- |
| 1 | Seller installs Worker | **OPEN**: the local harness launches the host-native Worker from the checkout; reproducible installed/background lifecycle belongs to the Worker packaging/update work. |
| 2 | Pair device | **SEPARATE**: one-time signed pairing/revocation tests pass; the installed job fixture starts from a pre-paired device. |
| 3 | Worker scans OpenClaw | **SEPARATE / OPEN live attribution**: read-only discovery and byte-preserving isolated tests pass. The live personal-state test encountered a concurrent Codex SQLite WAL writer. |
| 4 | Seller selects compatible skill/resources | **SEPARATE**: CLI import and explicit selection tests pass; the installed job uses a reviewed skill snapshot. |
| 5 | Generate separate runtime | **DIRECT**: the installed Worker creates unique Docker/OpenClaw job state. |
| 6 | Security checks pass | **DIRECT**: approved image, exact review, sandbox, broker and readiness gates run before execution. |
| 7 | Define input/output/price | **SEPARATE**: persisted visual input contract and seller publication tests use the authoritative Core schemas; the installed fixture provides reviewed terms. |
| 8 | Complete Stripe Connect | **OPEN external**: no ready test Connect account is configured locally. |
| 9 | Publish capability version | **DIRECT**: the installed harness stages the real Worker review, then the authenticated seller confirms the execution model, exact version changes and every permission in the Web form; the HTTP publication returns 201 before dispatch. |
| 10 | Buyer creates account | **SEPARATE**: auth/browser tests cover creation; the installed path seeds a distinct buyer identity. |
| 11 | Configure Stripe/payment | **OPEN external**: test Stripe Customer/payment method has not been exercised in this checkout. |
| 12 | Buy credits | **DIRECT development mode / OPEN Stripe**: authoritative development credits fund the job; the same harness has a Stripe test mode that cannot run without credentials. |
| 13 | Open capability | **DIRECT**: the distinct authenticated buyer opens the exact published capability in the Web app before the paid job. |
| 14 | Fill structured inputs | **DIRECT**: the buyer enters the question in the Web form and receives a server quote; the same input is submitted through buyer REST for the paid job. |
| 15 | Upload optional files | **DIRECT**: the buyer selects `source.txt` in the Web form; a signed private PUT, finalize response and READY asset are asserted before the paid REST purchase uses that exact asset ID. |
| 16 | Submit job | **DIRECT**: buyer REST creates the paid job with a durable idempotency key. |
| 17 | Validate inputs/assets | **DIRECT**: shared Core buyer service checks immutable contract and private asset ownership. |
| 18 | Reserve credits atomically | **DIRECT**: PostgreSQL financial reservation precedes dispatch; failure cases release it. |
| 19 | Create job and attempt | **DIRECT**: durable job, execution/attempt and transition rows are asserted. |
| 20 | Select online bound Worker | **DIRECT**: scheduler chooses the ready seller-bound device. |
| 21 | Send signed offer | **DIRECT**: outbound polling uses authenticated Worker Protocol messages. |
| 22 | Validate offer | **DIRECT**: Worker verifies identity, plane, lease, payment and exact package. |
| 23 | Accept | **DIRECT**: signed acceptance is persisted before execution. |
| 24 | Download assets | **DIRECT**: Worker fetches a short-lived private input URL. |
| 25 | Verify hashes | **DIRECT**: staged bytes are hashed and type checked before use. |
| 26 | Create unique job directories | **DIRECT**: per-attempt private directories are observed and later removed. |
| 27 | Validate effective policy | **DIRECT**: pinned OpenClaw and Docker policy checks run. |
| 28 | Start isolated OpenClaw | **DIRECT**: actual pinned OpenClaw runs inside Docker. |
| 29 | Enforce runtime/network/tool limits | **DIRECT**: live paid container probes plus paid runaway-model cap and Docker resource tests. |
| 30 | Collect declared output | **DIRECT**: summary and structured result files are collected from the stopped sandbox. |
| 31 | Validate output files | **DIRECT**: Worker and cloud revalidate type, size, hash and malware; live EICAR is rejected. |
| 32 | Upload outputs | **DIRECT**: signed private S3-compatible uploads complete. |
| 33 | Finalize result | **DIRECT**: durable Worker outbox retries a lost acknowledgement. |
| 34 | Verify output assets | **DIRECT**: cloud copies and verifies assets before finalization. |
| 35 | Mark delivered | **DIRECT**: persisted delivery/result transition precedes settlement. |
| 36 | Settle reservation | **DIRECT**: one immutable settlement journal is asserted after output finalization. |
| 37 | Record seller earning/platform fee | **DIRECT**: ledger split and zero duplicate earning are asserted. |
| 38 | Create/reconcile Connect transfer | **OPEN external**: real Stripe test Connect transfer needs a ready test account and purchase. |
| 39 | Expose result to buyer | **DIRECT**: buyer REST retrieves the result; another account receives 404. |
| 40 | Buyer sees final text/result | **DIRECT**: the distinct authenticated buyer opens the actual completed job page after the installed Worker run; it displays the Core `COMPLETED`/`SETTLED` state and two finalized file deliverables at desktop and mobile widths. |
| 41 | Buyer downloads generated files | **DIRECT**: the owning buyer downloads both private files through authenticated browser links and the REST key; another buyer's key receives 404. |
| 42 | Buyer rates/reports | **DIRECT development mode**: after reopening the real paid result in a new authenticated browser session, the buyer submits one verified review and a problem report. The database contains one buyer/job review and one report; settlement remains one journal. |
| 43 | Worker cleans temporary state | **DIRECT**: Docker containers and staged attempt directories disappear after success and failure. |
| 44 | Worker remains ready | **DIRECT**: subsequent paid/cancelled/failure jobs use the same installed device after reconnect. |

`IO-0035` and `IO-0036` remain non-VERIFIED. The closing test must combine
all 44 steps in one authentic staging trace with a supported Worker installation,
actual Stripe test purchase/Connect. These
separate component results cannot be added together to claim that event.
