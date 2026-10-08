# M16 review of Master Spec §60 job directories

The original §60 defines per-attempt input, work, output and metadata
boundaries. The effective Docker policy is checked after container creation,
not inferred from arguments alone. `verifyEffectiveContainer` requires exactly
one read-only input bind and, when output collection is enabled, exactly one
bounded writable tmpfs-backed output volume. The root filesystem is read-only;
`/job/work` is an ephemeral tmpfs. No metadata directory or parent runtime
directory is mounted. The collector can mount only the stopped job's output
volume read-only. Source: `packages/sandbox-adapter/src/docker.ts`.

| Requirement | Executable evidence |
| --- | --- |
| `JOB-0032` whole §60 | Real Docker policy/cleanup in `tests/docker-sandbox-local-integration.mjs`, output collection in `tests/docker-sandbox-output-local-integration.mjs`, and unique paid-attempt directory/container cleanup after success, model failure, storage fault and malware rejection in `tests/m16-installed-worker-e2e.mjs`. |
| `JOB-0033` input read-only | The live unprivileged container cannot write `/job/input`; effective bind `RW=false` is inspected before start. |
| `JOB-0034` work/output separation | `/job/work` and `/job/output` are writable tmpfs; only `/job/output` is mounted into the read-only collector. Path, symlink, sparse-file and output-size attacks in `tests/docker-sandbox-output-local-integration.mjs` are rejected. |
| `JOB-0035` metadata isolation | The live container observes no `/job/metadata`; effective mount count denies a separate metadata bind. |
| `JOB-0036` no parent runtime mount | Effective mount count and exact source check reject extra/ancestor binds; the live host sentinel in the parent attempt tree is inaccessible. |
| `JOB-0037` honest deletion claim | Worker removes temporary attempt paths after terminal success/failure. The output volume is tmpfs and destroyed after collection. Kivro makes no cryptographic secure-deletion claim for SSDs or host/object-storage media. Retention and object lifecycle remain separate mandatory gates. |

This review addresses the individual §60 directory constraints. It does not
claim that all M26 crash/reboot and retention/lifecycle scenarios pass; those
remain separately tracked.
