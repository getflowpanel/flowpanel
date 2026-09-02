---
"@flowpanel/next": minor
---

Every entry point that reaches a resource goes through the same guards, decoders and dispatch table, so the JSON API, the rendered page and the action routes agree on access, filters, pagination, deletes and error envelopes. Writes from an admin behind a reverse proxy are accepted, and the drawer opens and switches tabs without a server round-trip.
