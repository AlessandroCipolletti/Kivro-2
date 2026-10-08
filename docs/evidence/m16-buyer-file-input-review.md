# M16 original Master Spec §12 buyer file-input review

The §12 review found a real M10/M13 production defect: input finalization
validated size, hash and type, but did not invoke the malware scanner. The
result scanner did not protect buyer inputs before they became attachable.
`MarketplaceAssetRepository` now scans the **final private object bytes** in
both direct and streamed upload paths before the transaction can set `READY`.
The Web composition root requires a ClamAV socket for uploads. A missing
scanner, infected file or scan failure leaves the input `PENDING_UPLOAD`, so
Core cannot quote or purchase a job using it. The buyer API and Web return
bounded structured scan errors without exposing scanner output or file bytes.

| §12 rule | Production boundary | Executed evidence |
| --- | --- | --- |
| Bounded, allowlisted files | `capability-io.ts`, `file-limits.ts`, `file-types.ts`, `input-object-validation.ts`, `job-instructions.ts`, `job-execution.ts` enforce count, per-file, per-field and whole-job byte limits, extension plus detected MIME, exact hash and supported formats. Archives have no publishable format. | `io-readiness.test.mjs`, `assets.test.mjs`, `input-staging.test.mjs`, M10/M13 PostgreSQL tests. |
| Malware scanning before attachment | `marketplace-assets.ts` scans the final private input object before `READY`; production Web composition requires `KIVRO_CLAMAV_SOCKET`. | M10 PostgreSQL infected/scanner-outage/retry/blocked-quote cases; `m15-clamav-live.test.mjs`; installed paid E2E uploads real EICAR to private storage, receives `UNSAFE_FILE`, retains `PENDING_UPLOAD` and cannot buy that job. |
| Generated names and isolation | Worker input staging uses asset UUIDs and validated extensions rather than the buyer filename; Docker mounts `/job/input` read-only, with a separate writable work/output area. | `input-staging.test.mjs`, `docker-sandbox-local-integration.mjs`, installed paid E2E real buyer upload and mounted input. |
| No seller personal directories | Docker adapter mounts only the job workspace and approved broker surfaces. | Installed paid Docker probe denies host home, SSH, Documents, Downloads, Desktop, personal OpenClaw state, Docker socket and network; Docker mount tests also deny input writes. |
| Temporary cleanup | Worker attempts and sandbox directories are removed after terminal execution; private object retention is explicit rather than depending on local disk. Durable object expiry/deletion remains a distinct later retention gate. | `docker-sandbox-local-integration.mjs`, `docker-output-storage-local-integration.mjs`, installed paid failure/terminal cleanup checks, `tests/sql/m05_assets.sql` retention guards. |

This evidence covers the §12 file-input boundary with development credits and
real Docker/OpenClaw/ClamAV. It does not claim a real Stripe-funded staging
purchase or public-release security review; those are separate gates.

The same production path closes `IO-0068`–`IO-0070` from §197. The published
file field requires explicit count, byte, MIME and extension constraints;
the server validates the final stored bytes and detects MIME independently
of the browser claim before the asset can enter a paid job. The Worker stages
only the validated, buyer-owned asset into the read-only sandbox input mount.
