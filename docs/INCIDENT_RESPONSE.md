# Incident response

This runbook is required before external alpha. Treat buyer input, Worker messages, seller device state and returned files as potentially hostile. Preserve a minimal, access-controlled incident record with UTC time, correlation/job/device IDs, actor, action, and the affected immutable version hashes. Do not copy buyer contents, OpenClaw personal config, provider secrets, or raw credentials into the record. Keep evidence private and apply the configured retention/legal hold policy.

## First response

1. Identify the affected environment (`local`, `test`, `staging`, `production`) and incident scope. Never use credentials or buckets from another environment.
2. Stop **new** dispatch using the authoritative global control-plane kill switch. Revoke/disable affected Worker or capability identities and seller-local pause as appropriate. Existing jobs need an explicit cancel/finish decision; do not mark them failed solely because a Worker message says so.
3. Reconcile every affected job against durable attempts, leases, object manifests, payment reservations and ledger entries. No Worker event can authorize capture, earnings or payout without finalization. Release/refund once according to the job state machine.
4. Capture sanitized logs, policy/manifest hashes, version/build metadata and affected object hashes. Restrict access, record the custodian and avoid logging secret values.
5. Notify affected parties through approved channels after impact is assessed. Record remediation, test evidence, credential rotation, and safe re-enablement criteria.

**Current implementation limit:** the global dispatch control, full job/ledger reconciliation and notification tools are not yet built. External alpha is blocked until they exist and are tested. Local Worker pause does not substitute for a cloud kill switch.

## Compromised Worker release or device key

- Raise the minimum allowed Worker version and stop dispatch to the vulnerable version. Revoke affected device identities and prevent new claims at the server, including reconnect and delayed polling paths.
- Preserve version, package checksum, device and attempt IDs. Identify in-flight attempts; cancel or quarantine them and reconcile reservations without duplicate settlement.
- Build and verify a fixed signed Worker package, publish checksums and compatibility metadata, require upgrade, and rotate device credentials where exposure is possible. Retest old/new control-plane transition and revoked-device rejection before restoring dispatch.
- Inform sellers what to update and whether any local credential rotation is needed. Do not request their raw secrets.

## Seller credential or private resource exposure

- Pause the affected Worker/capability locally and at the control plane; revoke its broker grant. Rotate the provider, DB or API credential at its source, then update the seller-local secret reference.
- Examine sanitized operation audit, resource scope and spending. Check whether other capabilities used the same reference.
- Require a new permission/health/security review and immutable capability version before republishing. Do not infer seller consent from discovery or a changed skill.

## Malicious buyer or hostile output

- Suspend the buyer identity, stop new jobs, and cancel or quarantine active attempts through authoritative state transitions. Preserve only necessary audit evidence with access restrictions.
- Check affected sellers, broker operations, blocked network attempts, output scanning and any asset access. Quarantine unsafe result objects; do not serve unvalidated Worker output.
- Reconcile each payment/credit reservation and refund according to the ledger. Do not create a manual second charge or earning to compensate for a race.

## Marketplace or signing-key compromise

- Disable dispatch globally, revoke sessions/API keys and rotate cloud signing and storage credentials. Investigate device-token exposure and rotate affected Worker identities.
- Audit access to buyer assets and immutable ledger records. Seller local DB/provider secrets should not be stored centrally; assess exposure rather than assuming they leaked.
- Restore from verified code/artifacts and validated migrations. Replay reconciliation idempotently, compare ledger balances to processor events, and require security/regression gates before reopening.

## Re-enablement gate

Incident owner signs off only after the exploit path is closed, affected identities/secrets are rotated or revoked, actual sandbox/broker/authorization regression tests pass, in-flight jobs and financial balances reconcile, and required notices are sent. Keep the incident open if any prerequisite lacks evidence.
