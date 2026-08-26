---
"@flowpanel/core": minor
"@flowpanel/next": minor
"@flowpanel/cli": minor
---

Hand the request to `auth.session`, and stop the demo working around its absence.

`AuthConfig.session` took no argument, so a provider that needs the request had
nowhere to get it. The flagship demo forged one —
`getDemoSession(new Request("http://flowpanel.local/", { headers: await headers() }))`
— in the very file its footer links to as the config to copy. Any real provider
modelled on it (`getServerSession(req)`, Lucia's `validateRequest(req)`, a
host-keyed tenant resolver) would read `flowpanel.local` and pick the wrong
tenant, origin or cookie policy.

`session` now receives the request being served. A helper that ignores the
argument still satisfies the type, so existing configs are unaffected.

`flowpanel dev` accepts `scripts/board-server.mts` alongside `.ts`. The demo's
board script is now `.mts` with a static `import { startBoardServer } from
"@flowpanel/kit/bullmq/board"`, replacing a dynamic import inside an `async
main()` that existed only because an ESM-only subpath cannot be required from a
CJS module.

The ejected layout template passes `apiBase={config.paths.api}` to
`FlowpanelGlobals`. Without it every client fetch in an ejected admin — drawer,
actions, inline edit, import, reference search, SSE — fell back to
`/api/flowpanel` and 404'd under a custom `paths.api`.
