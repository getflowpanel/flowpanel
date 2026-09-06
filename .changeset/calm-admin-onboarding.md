---
"@flowpanel/cli": minor
"@flowpanel/core": minor
"@flowpanel/next": patch
"@flowpanel/react": minor
---

Validate local client/schema/auth imports before scaffolding, support index modules
and explicit module flags, detect grouped admin route collisions, and share static
mount resolution with doctor. Init now imports CSS from its own admin layout and
leaves the host root layout unchanged. Unknown authentication stays closed; the
previous open development identity requires explicit `--dev-auth`.

Await asynchronous role lookup before request authorization. Render only the active
visible detail tab and preserve tab navigation in browser history. Forward the host
CSP nonce through ThemeScript. CLI errors display nested causes with connection URL
credentials and parameter dumps redacted.

Resource list search respects the configured `labels.searchPlaceholder`, including
the resource label placeholder, while preserving the default English text.

Honor `detail.header` as authorized heading content. `PageHeaderProps.title` now
accepts React content; custom slots should use the exported props type. Hide the
detail edit action when update access is denied and localize it with `actions.edit`.

Resolve inherited TypeScript paths and baseUrl using TypeScript's JSONC/extends
parser, including package configs and ordered multiple bases. Reject incomplete
alias metadata from missing/cyclic configs and normalize wildcard-root aliases
for the migration loader.

Export the pure `buildThemeInitScript` from the server-safe core/kit entry while
preserving its React export. Initialize the configured theme even when storage
is blocked; accept only known modes in the generated script body. The host owns
CSP headers and the nonce.
Browser callers use the isolated `@flowpanel/core/theme` entry, keeping Node
request-context dependencies out of the client graph.

Existing installations keep their generated files. Reconcile root stylesheet/theme
imports manually when adopting the new route layout; init will not overwrite them.
