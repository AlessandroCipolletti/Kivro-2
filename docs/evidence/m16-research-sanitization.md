# M16 narrow research sanitization review

Master Spec §271 distinguishes normalized untrusted research content from raw
executable HTML/JavaScript. `ResearchBroker.fetch` is the production path for
the `kivro_research_fetch` tool. It permits only approved content types and
returns a bounded `text` field tagged `UNTRUSTED_PUBLIC_WEB`. For HTML it
removes script/style/SVG/iframe/object/template blocks, strips markup and
control characters, then returns plain text. The Worker router exposes this
tool only for the exact reviewed policy and job binding. The Docker/OpenClaw
sandbox has no personal browser/session or generic browser tool.

`tests/research-broker.test.mjs` passes hostile HTML, oversized and malformed
responses through the production normalizer. The real Docker/OpenClaw test in
`tests/docker-openclaw-selected-file-local-integration.mjs` now makes the
model request a blocked page and then an allowed hostile page. The model's
next transcript contains normalized public text without `<script>` or its
body; a truthful limitation is submitted for the blocked source. The
isolated runtime has no personal browser/session or generic browser tool.
`tests/m16-installed-worker-e2e.mjs` separately exercises the same brokered
research route in a paid job. These close §271 (`PRD-0266`/`PRD-0267`)
against its original sanitization and local-browser constraints. The
continuous hostile-source-to-buyer-preview scenario remains a useful later
release regression; it is not an additional mandate stated by §271.
