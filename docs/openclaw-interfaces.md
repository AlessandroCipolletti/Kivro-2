# OpenClaw inspection interface (M00)

The live adapter currently performs version detection only. It does not construct a worker environment, authorize a skill, declare an OpenClaw version compatible, or execute a buyer job.

| Command | Purpose | Parsed fields | Discarded data |
| --- | --- | --- | --- |
| `openclaw --version` | Detect installed runtime | Semantic version | Build text |
| `openclaw config validate --json` | Fixture parser only; live command disabled | `valid` boolean | Error details, paths, config values |
| `openclaw skills list --json` | Fixture parser only; live command disabled | Skill `name`, `eligible` | Workspace paths, descriptions, source, missing requirements, other metadata |

The command runner allowlists only `--version`, uses no shell or stdin, enforces a time and output limit, and kills the process group on timeout/overflow. Failed or unknown inspections yield unavailable discovery. Fixture-only parsing still redacts all metadata except skill names and eligibility, with `consent: not-granted`.

On 2026-10-06, OpenClaw 2026.8.2 `skills list --json` attempted to harden permissions in the seller's personal OpenClaw state while running. The filesystem sandbox rejected those writes with `EPERM`. This proves that the command cannot be treated as a read-only discovery interface even though its name suggests listing. We disabled it, along with live config validation pending a pinned isolated inspection design. No personal-state mutation is an acceptable scan behavior.

Run `pnpm openclaw:inspect` to repeat the sanitized probe. It prints the version and unavailable config/skill status, without touching the personal state through those commands.

Official interface references: [CLI](https://docs.openclaw.ai/cli), [skills](https://docs.openclaw.ai/cli/skills), [config validation](https://docs.openclaw.ai/cli/config). Future OpenClaw versions must be checked against these interfaces and an explicit compatibility policy before paid execution is enabled.
