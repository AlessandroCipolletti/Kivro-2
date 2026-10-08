# M16 original §18 threat-model review

The original threat model names malicious buyers, malicious sellers, hostile
skills/plugins and a compromised marketplace. `spec/SECURITY-EVIDENCE.md` and
`docs/evidence/m16-attack-matrix.md` enumerate their trust boundaries and
locally executable probes. The full section gate remains open for independent
security assessment and the remaining complete attack matrix; the narrow
requirements below have direct evidence.

- **Platform minimum policy (`PRD-0033`).** Seller-authored capability data
  cannot remove the Worker-required pinned sandbox, offline network, read-only
  root, dropped capabilities or resource limits. `packages/sandbox-adapter/src/docker.ts`
  enforces the flags, and `tests/docker-sandbox-local-integration.mjs` plus
  the installed paid E2E probe forbidden host, LAN and metadata access.
  `apps/worker/src/job-admission.ts` fails closed if readiness is absent.
- **Physical seller trust disclosure (`PRD-0034`, `PRD-0035`).** The production
  privacy page now says plainly that the seller controls the physical machine
  and Kivro cannot cryptographically prevent observation of job inputs or
  modification of the local Worker. `tests/browser-m10/marketplace.spec.ts`
  verifies the rendered disclosure.
- **Pinned skills and dependencies (`PRD-0036`).** A published version binds
  exact package/skill hashes; `WorkerCapabilityPackageStore` and
  `WorkerRuntimeReadiness` refuse changed bytes until seller revalidation.
  `tests/worker-runtime-readiness.test.mjs`,
  `tests/seller-publication-contract.test.mjs` and the hostile-skill Docker
  suite exercise that boundary.
- **Local seller secrets (`PRD-0037`, `PRD-0038`).** The cloud receives opaque
  resource IDs/permission categories, never seller database passwords or
  arbitrary local credentials. The Worker local vault and the version/job
  scoped brokers mediate access; `tests/selected-local-file.test.mjs`,
  `tests/docker-openclaw-selected-file-local-integration.mjs` and
  `tests/m06-postgres-integration.mjs` deny unapproved resources and enforce
  the dedicated read-only database role. A cloud compromise still requires a
  separate authorized Worker execution and cannot automatically read every
  seller resource.

This is technical local evidence and truthful disclosure. It does not claim
an external red-team assessment, secure hardware on the seller's machine or
that a malicious seller cannot observe plaintext on their own computer.
