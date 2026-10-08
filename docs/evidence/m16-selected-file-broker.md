# M16 seller-selected local file boundary

Original sources: Master Spec §§299–301 (`SEC-0092`, `SEC-0095`,
`CAP-0067`, `CAP-0068`) and the mandatory sandbox/permission rules.

The seller declares a `LOCAL_FILE` or `LOCAL_DIRECTORY` candidate, explicitly
selects it, and supplies a canonical absolute path in the private Worker
package authoring file. `captureSelectedLocalBinding` rejects traversal,
symlinks, special files and personal configuration locations. It snapshots a
bounded set of regular files with device/inode/size/SHA-256 into the immutable
version-local package. The cloud candidate gets the package hash, resource IDs
and `SELECTED_ONLY` public permission state, never a seller host path or file
bytes. A new path, changed content or changed permission requires a new
reviewed capability version.

The paid Worker composes `SelectedLocalFileBroker` for exactly those resource
IDs. Admission rechecks the pinned files; every read rechecks the root,
symlinks, file identity and hash. OpenClaw receives an opaque resource/file ID
tool, not a seller filesystem mount. Its request passes through the fixed
Docker bridge, signed job/lease-aware sidecar and version-scoped router. The
response is a bounded read-only byte range. Before any bytes leave the Worker,
the broker durably marks a private-resource read; if that barrier is unavailable
the read fails closed. Local SQLite audit stores job,
version, opaque IDs, byte count and a structured denial reason; it stores no
file content or host path.

Executable evidence:

- `tests/import-package.test.mjs`: declaration, explicit selection, private
  immutable binding, cloud candidate redaction and public `SELECTED_ONLY`.
- `tests/selected-local-file.test.mjs`: file/directory capture, only-selected
  reads, changed-content and stale-policy denial, traversal, symlink,
  personal-state and special-location denial, durable private-read marker and
  denial when the marker cannot be written.
- `tests/docker-selected-file-broker-local-integration.mjs`: real offline
  Docker bridge, Worker broker, direct host-file mount denial and no mutation
  route.
- `tests/docker-openclaw-selected-file-local-integration.mjs`: pinned real
  OpenClaw invokes `kivro_selected_file_read`; the deterministic model receives
  only the selected bytes and the output contract is validated.

This initial component record has since been extended. The same selected-file
version is now seller-published, buyer-rendered and executed in the installed
development-credit Docker/OpenClaw path. A second seller-published version
combines public research, read-only database, selected dataset and fixed
read-only API in a representative Docker/OpenClaw review. The exact evidence
and remaining Stripe release distinction are in
`docs/evidence/m16-research-private-resources.md`.
