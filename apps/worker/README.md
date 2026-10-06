# Seller Worker

The host-native Worker foundation has local SQLite pause/audit state, a version-only OpenClaw probe, an encrypted Ed25519 device-key fallback and a CLI (`pnpm worker health --json`, `pnpm worker doctor --json`, `pnpm worker pause --all`). The CLI reports `NOT_READY` until identity pairing, keychain storage, cloud connection, payment, manifest, runtime and sandbox gates are implemented and verified. `resume` currently fails closed because those checks do not pass.
