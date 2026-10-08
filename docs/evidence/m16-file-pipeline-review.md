# M16 targeted review of Master Spec §61 file-pipeline requirements

The original §61 text was reviewed per ID. `docs/evidence/m16-boundaries.json`
records the complete local matrix, including actual private S3-compatible
storage, PostgreSQL, the installed Worker, Docker/OpenClaw and authorized buyer
downloads. The individual rules below have direct production and executable
evidence. The full §61 browser upload → finalization → secured-credit paid
Worker → isolated output → private buyer download path now passes, so
`IO-0013` and `IO-0014` are verified for the file pipeline itself. Real Stripe
test funding and the final whole-product release gate remain open separately.

| ID | Enforced production path | Executed evidence |
| --- | --- | --- |
| `IO-0015` | `marketplace-assets.ts` issues a signed direct object-storage upload; Web/API transfers no large body | M13 PostgreSQL REST direct PUT/finalize and M10 PostgreSQL upload tests |
| `IO-0016` | `marketplace-buyer.ts` rejects assets lacking `READY`; `job-execution.ts` locks and rechecks them | M13 PostgreSQL test now uploads staging bytes, tries purchase before finalize, receives `INVALID_INPUT` and creates zero jobs; then finalizes and purchases |
| `IO-0017` | `job-execution.ts` materializes opaque IDs, paths and signed GET grants for the Worker; no file byte payload enters control messages | M13 signed Worker RPC and installed paid Worker file round trip |
| `IO-0018` | `job-execution.ts` issues expiring private download grants; Worker `input-staging.ts` pins the storage origin and rejects redirects | Installed paid Worker download and `input-staging.test.mjs` hostile URL/redirect probes |
| `IO-0019` | Docker adapter mounts staged input read-only | Real Docker sandbox write-denial in `docker-sandbox-local-integration.mjs` and installed paid sandbox probe |
| `IO-0020` | Worker `input-staging.ts` derives local paths from validated field key, asset UUID and extension, never buyer filename | `input-staging.test.mjs` forged path rejection and installed paid private input |
| `IO-0021` | Original filename is stored only as upload metadata in `marketplace-assets.ts`; Worker binding uses the asset ID | M13 direct upload/finalize plus Worker staging and paid Docker input round trip |
| `IO-0022` | Docker read-only root and input mount leave only bounded job output writable | Real Docker root/input denial and paid held-container probe |
| `IO-0023` | Output collector reads only `/job/output` after stop | Real Docker output collection and private storage integration |
| `IO-0024` | Output path parser and collector reject absolute paths, traversal and `/etc/passwd` symlinks | `output-transfer.test.mjs` and real Docker symlink output rejection |
| `IO-0025` | `output-upload.ts` checks `realpath` descendant and `O_NOFOLLOW`; collector refuses escaped output | `output-transfer.test.mjs`, Docker output rejection and installed paid validated upload |
| `IO-0026` | `output-upload.ts` sends asset ID, hash, size, MIME and object key through the signed cloud finalization protocol; bytes go directly to private storage | M13 signed Worker finalization and installed paid file result/ledger settlement |
| `IO-0027` | Buyer REST output access resolves ownership through Core and returns 404 to another buyer | Installed paid buyer download and cross-buyer 404 assertion |
| `IO-0028` | Private object keys and bucket policies have no permanent public URL; only authenticated route or expiring grants provide access | SeaweedFS/MinIO adapter tests and installed paid cross-buyer download denial |

The new pending-file negative test also found a prior M10/M13 HTTP mapping
defect: `BuyerMarketplaceError('INVALID_INPUT')` was returned as 409. Both Web
and buyer API routes now return structured HTTP 400 while retaining the Core
asset state guard. The M13 PostgreSQL suite passed after the correction.
