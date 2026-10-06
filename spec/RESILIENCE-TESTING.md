# Resilience & Fault-Injection Testing

Test ambiguous failures around DB commits, polling/WSS acknowledgements,
Worker claim/completion, Stripe webhooks, durable tasks, object
finalization, process restart, cache loss and dual-control-plane
coexistence.

Every scenario asserts converged authoritative state and exactly-once
financial effects. Provider-specific mechanics may differ; expected
Kivro semantics do not.

Maintain deterministic fixtures where possible and preserve failure
regression tests permanently.

## Durable result fault injection

Inject: object upload success/DB finalization failure; DB
transition/object upload failure; lost completion acknowledgement;
duplicate completion after restart; cloud restart in
scheduled/queued/running/finalizing; Worker disconnect before/after
finalization; notification failure; cleanup DB/storage partial failure;
signed URL expiry; missing/truncated/hash-mismatched output. Assert
convergence, authorization, truthful result state and exactly-once
financial effects.

## Buyer Experience race/fault tests

Inject cancel-vs-claim, expiry-vs-claim, quote expiry during checkout,
Worker heartbeat loss after quote, schedule-window miss, delayed
progress/reordered duplicate progress, ETA-history absence, notification
failure, bundle-generation failure, preview failure, retention reminder
duplication and reliability recomputation during concurrent job
completion. Assert understandable buyer state plus exactly-once
financial/job effects.

## Seller Experience fault/race tests

Inject pairing reconnect, stale health, dependency disappearance after
quote, pause-vs-claim, capacity slot races, provider spend-limit hit,
ledger/Worker earnings disagreement, auto-pause during active jobs,
rollback during in-flight old/new versions, maintenance transition,
notification storm, Worker Doctor partial failures and two-Worker
reconnect/routing races. Assert deterministic seller state, no security
weakening and exact financial/job ownership.
