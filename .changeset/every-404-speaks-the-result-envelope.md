---
"@flowpanel/next": patch
---

Unknown-route 404s answer in the result envelope.

The catch-all handlers and `notFoundResponse` returned `{ error: "not found" }`
with a bare string, which `@flowpanel/client` could not recognise — an unknown
resource surfaced as `internal` / "Unexpected response from Flowpanel." instead
of `not_found`. All 404 bodies are now
`{ ok: false, error: { code: "not_found", message } }`.
