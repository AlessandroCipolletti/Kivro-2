# M07 OpenClaw runtime candidate

`Dockerfile` pins the official Node 22 base by registry digest. `package-lock.json` pins OpenClaw 2026.8.2 and every npm dependency by integrity. The OpenClaw package needs its install lifecycle scripts; they run inside the image build, never against the seller's personal OpenClaw state.

Run `pnpm test:openclaw:image` from the repository root. It builds a local image, resolves its digest and starts the OpenClaw CLI through Kivro's non-root, read-only, network-denied Docker sandbox policy. The resulting digest is local build evidence, not a production approval or a stable digest to paste into capability packages.

Only a version/isolation probe has passed. The Worker remains `NOT_READY` until an approved digest, real job execution conformance, effective tool and broker routing, credential isolation, signed Worker delivery and secured payment are all proven. Never use the mutable `:m07` build tag as an executable job plan and never fall back to the seller's personal OpenClaw process.
