# Security Evidence Matrix

Maintain a live Threat → Control → Test → Evidence matrix derived from
the Master Spec. Required categories include sandbox escape/private
seller data, malicious seller handling of buyer data, skill/supply
chain, SSRF/private networks, credentials, arbitrary proxy abuse,
payment replay/double settlement, cross-control-plane routing, asset
path/special-file attacks, webhook forgery and Worker version
compromise/revocation.

Security claims without test/review evidence remain incomplete.

## Durable result security evidence

Evidence must cover cross-buyer and cross-seller denial, anonymous
denial, short-lived URL expiry, private-bucket direct-object denial,
cleanup race safety, incomplete/malicious Worker completion blocked by
finalization, and missing/corrupt output detection.

## Buyer Experience privacy/security evidence

Prove Worker payload minimization; no payment/email/profile leakage;
privacy disclosure matches serialized job payload; preview
isolation/sanitization; bulk-download traversal defense; result
authorization; problem-report evidence isolation; reliability
aggregation contains no buyer-private fields.

## Seller Experience security evidence

Prove discovery does not expose resources; AI draft cannot authorize;
effective visual permissions equal machine manifest; secrets remain
local/redacted; Worker payload minimizes buyer identity; diagnostics are
sanitized; provider spend guardrails are buyer-proof; rollback cannot
reactivate security-incompatible version; public marketplace identity
does not leak KYC identity; multi-Worker routing preserves isolation.
