# M16 result and progress privacy — Master Spec §64

The buyer job page reads persisted job lifecycle events and maps them to
plain-language stages. `QUEUED`, `STARTING`, `RUNNING`, `UPLOADING_RESULT`,
`COMPLETED` (the delivered result), and terminal failure states are explicit
Core states. The page does not consume a model token stream or a Worker
diagnostic stream. It displays no derived percentage or estimated completion
time. Only a validated private result is fetched after completion.

In the installed development-credit E2E, a distinct buyer opens the actual
paid job while the real Docker/OpenClaw model request is held. The browser
shows `Running` and the reserved payment state; it contains no OpenClaw tool
names, `tool_calls`, chain-of-thought label, or invented completion percentage.
The same run later displays the completed private result and a separate failed
job with a buyer-safe reason. The model invokes input and output broker tools,
so the absence assertion covers an actual internal tool sequence. The test
passes at desktop and mobile and runs accessibility assertions at both sizes.

Evidence: `apps/web/app/buyer/jobs/[id]/page.tsx`,
`apps/web/app/discover/marketplace-ui.tsx`,
`packages/persistence/src/job-execution.ts`,
`tests/m16-installed-worker-e2e.mjs` (`pnpm test:e2e:local`, 2/2 passed
2026-10-07). This closes `JOB-0038`–`JOB-0041` individually. It does not
claim a buyer-visible token-streaming feature, which §64 explicitly does not
require for the first MVP.
