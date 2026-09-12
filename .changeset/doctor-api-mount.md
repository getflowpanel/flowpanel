---
"@flowpanel/cli": patch
---

`init` and `doctor` follow the API mount the configuration actually declares.
Both read `paths.api` alongside `paths.admin`, scaffold and repair the route
handler and the SSE endpoint where the config points, and check the admin URL for
an overlap against that mount rather than against `/api/flowpanel`. The generated
config records the mount that was scaffolded.

A `paths.api` that is not a static string is unknown, not the default: `init`
refuses to write rather than guessing, and `doctor` says so instead of repairing
routes the configuration never points at.

FlowPanel's own not-found page reads its title, description and back link from
`labels.notFound`, so an admin configured in another language no longer answers in
English.
