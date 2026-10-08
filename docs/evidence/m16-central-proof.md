# Remote untrusted-buyer boundary (§49)

`pnpm test:e2e:local` uses distinct authenticated seller and buyer accounts.
The seller reviews and publishes an exact skill/resource manifest in Web UI.
The buyer secures development credits, purchases the published capability and
supplies a private input file. A host-native Worker accepts the signed offer
over outbound transport, then runs pinned OpenClaw in a mandatory Docker
sandbox. The result is finalized to private storage and the buyer receives it
after one ledger settlement.

The same paid container attempts to read seller/personal OpenClaw state,
environment secrets and the Docker socket, and to connect to localhost, LAN,
public Internet and the metadata address. These technical probes fail; the
host-side broker permits only the reviewed capability routes. Additional
Docker and broker-sidecar tests exercise forbidden `read`, `exec`, `browser`,
privilege and resource-limit paths. The M16 boundary matrix passed all 32
steps with live Docker/OpenClaw on 2026-10-07.

This establishes the two specific §49 central-proof requirements and the
existence of security-invariant tests. It does not represent the entire §49
historical build-order/private-alpha roadmap or the §92 Stripe-funded public
release gate as complete.
