# Scoped, consistent admin presentation

Confirmed defects: generated Tailwind 4 CSS imports global Preflight; the v3
template emits `@tailwind base`. Loading an admin route can reset unrelated host
headings, buttons and borders. The new translated navigation label also exposes
an existing focus selector coupled to `aria-label="Admin"`. In the live host,
growth cards have unequal heights (156/116/98 px at 1280 px) and lime active
backgrounds retain blue foreground text.

## Framework contract

- Generated v3/v4 styles must not apply a global element reset. Preserve the
  theme map, utilities and package-source discovery, including pnpm isolation.
  Supply only the required element defaults inside FlowPanel roots and portals,
  with low specificity so utility classes and host overrides still win.
  Borders, box sizing, typography, controls and focus must work without a host
  Tailwind reset. A source assertion alone is not sufficient evidence.
- Use a stable navigation data marker for focus selectors. Accessible labels
  are presentation and must be freely translatable, including empty overrides.
  Keep core CSS and both generated templates consistent.
- Metric cards fill their existing grid row through the slot, optional
  drilldown anchor and card. Preserve responsive layout, real data, deltas,
  labels, accessible links and content; do not manufacture placeholder metrics.
- Theme customization must support coherent light and dark semantic text
  tokens. Prefer an additive `cssVarsDark` counterpart to existing `cssVars`
  rather than deriving potentially inaccessible colors from arbitrary accents.
  Scope these overrides to roots/portals, sanitize them identically, and document
  that foreground contrast must be chosen for its actual tinted background.
  Existing accent/accentDark behavior and consumer theme choices remain valid.

## Verification

Use real Tailwind compilers for both versions and real browser DOM behavior.
Before and after loading compiled generated admin CSS, unrelated host markers
(heading, link, input, button, list and border) retain their presentation. Admin
controls still respond to clicks and keyboard focus with translated nav labels;
portals are styled. Prove RED with original global import/base directive and
English-dependent focus selector, then GREEN. Existing package-source smoke
tests retain their protection with updated split imports. Packed npm and pnpm
Next consumers must still mount successfully; capture an admin-to-host client
navigation where feasible to cover stylesheet retention.

Measure equal card heights within a desktop grid row, usable mobile stacking,
and dark/light token overrides. Host theme will supply contrast-checked lime
badge foregrounds after packages are independently reviewed. No host source
edits or package adoption belongs to this framework phase.
