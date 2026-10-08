# Worker manifest versioning (§54)

The full local capability package contains the Worker manifest, reviewed skill
hashes, resource/tool/network policy and runtime limits. Its canonical hash is
bound to seller review and stored in the Worker's private package store. The
cloud publication persists the sanitized `PublishedCapabilityVersion`
snapshot, `worker_manifest_hash` and exact consents; it does not receive the
full Worker-local package. Each job records its purchased
`capability_version_id` and price/contract snapshot.

`tests/m14-publication-postgres-integration.mjs` rejects stale or mismatched
seller approval and keeps published versions immutable. The installed paid
Docker/OpenClaw test publishes remote v2, completes a paid job, changes the
skill bytes and runtime declaration for local v3, requires fresh seller Web
consent, and verifies the old job still points to v2 with its result while
both snapshots retain their distinct immutable package/skill hashes and
processor disclosures. This closes `CAP-0008` and `CAP-0009`; signed Worker
binary updates and deployed provider cutover remain separate gates.
