# Outbound Worker connectivity (§10)

The seller pairs a persistent device identity with a one-time expiring code.
The private signing key lives in the OS keychain or an explicitly protected
encrypted device file; no reusable seller account password is stored by the
daemon. Future hello, heartbeat and job RPC messages are signed, replay
checked and scoped to that device. `WorkerHeartbeatSchema` is strict and only
permits bounded release, OpenClaw compatibility, readiness, capacity and
pause metadata; local paths, environment values and secrets are not fields.

The installed paid local fixture opens an outbound HTTPS polling connection
from the host-native Worker, sends accepted heartbeats, receives signed offers
and completes a private buyer job without an inbound seller port, public IP,
public DB or firewall change. The mixed-transport loopback tests exercise
outbound WebSocket and polling with distinct control-plane ownership, replay,
reconnect and retirement. M07 pairing tests cover one-use/expiry and
impersonation rejection. All were included in the passing 32-step M16 matrix.

These tests close the original §10 connectivity behaviors. They do not claim
that both deployed Netsons/AWS composition roots have passed their separate
M19 provider conformance gates.
