# Kivro design system

M14 defines one restrained visual language for buyer and seller work. The source tokens and component rules live in `apps/web/app/design-system.css`; this document records when to use them. Product data remains in Core projections.

## Foundation

- **Type:** one system sans stack for UI. Display headings use the same family at a tighter letter spacing. Keep body at 14–16 px and supporting copy at least 12 px. Use tabular figures for prices, credits, counts and timing. Mono belongs only to code, IDs and keys.
- **Space:** 4, 8, 12, 16, 24, 32, 48 and 64 px. Increase spacing between decisions, not between every line. Body text line height is about 1.55.
- **Color:** warm neutral canvas (`--paper`), white object surfaces (`--card`), deep ink (`--ink`), legible secondary text (`--muted`), dark forest action (`--green`). Semantic success, warning, danger and information colors always appear with a textual state.
- **Borders and elevation:** one quiet line (`--line`), 6 px controls, 10 px object cards, 12 px panels. Shadows are reserved for overlays; normal page objects use a border or divider.
- **Icons:** a single 24 px coordinate, 1.75 px stroke SVG family in `apps/web/app/ui/kivro-icon.tsx`. Icons aid recognition and are decorative when a visible text label already explains the action. Avoid emoji and mixed Unicode glyphs.

## Patterns

- **Navigation:** the same destinations on desktop and mobile. Mobile uses a native disclosure menu with visible focus and a real text label. Buyer search remains a conventional search form.
- **Action hierarchy:** filled primary for the next decision, outlined secondary for alternatives, text tertiary for navigation, red outlined destructive for pause/remove. Disabled actions show a reason nearby where the cause is not obvious.
- **Inputs:** visible labels, 44 px minimum target, aligned help/error text, contrast on focus. Use `aria-invalid` and an associated error ID for field errors. Never rely on placeholder copy as the only label.
- **Statuses:** labels come from the shared marketplace status vocabulary. Success, warning, critical and neutral treatments are semantic; label text carries the meaning. Never show a progress percentage without measured progress or an ETA without evidence.
- **Cards and lists:** a card represents a capability, Worker, job or payment object. Repeated operational facts use rows and dividers. Avoid nesting card surfaces just to make sections look finished.
- **Disclosure:** buyer essentials stay visible: what the service does, input/output, price, availability, seller, permissions summary and CTA. Exact technical permission rows, job IDs and advanced controls can live in native `<details>` disclosure, with a clear summary.
- **Overlays:** use a native dialog only for a decision that interrupts the current task; give it a labeled heading, a clear cancel path, focus return and no decorative backdrop blur. Mobile navigation uses a native disclosure rather than a drawer. Inline disclosure is preferred for diagnostics and permission detail.
- **Empty/error/loading:** state the situation and next step in literal language. Loading buttons show the action underway and disable duplicate submission. Preserve server error codes for diagnostics but show a comprehensible label when possible.
- **Motion:** only short hover/focus feedback. Disable it under `prefers-reduced-motion`.
- **Responsive:** desktop has an aligned content grid; tablet reduces columns; mobile stacks decisions, keeps controls at touch size and never hides navigation destinations.

## Screen hierarchy

Discover: search and filters → current capabilities → price/availability/trust. Detail: service identity → price/availability/CTA → inputs/outputs → examples/reviews/permissions. Buyer: active work and credits → history → result actions. Agent: intent → grounded shortlist → plan/total authorization → job states. Seller: Worker and global controls → readiness and queued/running work → capability settings → earnings/diagnostics. Account: identity → buyer integrations, with secrets shown only once.

Visual review evidence and viewport checks belong in `docs/milestones/M14.md` and browser tests. M14 does not treat a screenshot as evidence of backend publication, financial authorization or runtime safety.
