---
"@flowpanel/react": minor
---

**B10 — Hooks + tag-based invalidation.**

Canonical short-name hooks:

- `useResource` — alias of `useResourceData`.
- `useMetric(baseUrl, name, { timeRange?, invalidatedBy? })` — fetches a
  metric by name; refetches automatically on any invalidation tag.
- `useLiveRuns` — alias of `useFlowPanelLive`.
- `useMutation(baseUrl, path, { invalidates?, onSuccess?, onError? })` —
  minimal fetch-based mutation; broadcasts tags in `invalidates` on success.

`subscribeToInvalidation` / `broadcastInvalidation` expose the bus for
custom integrations. Tag names are free-form; the convention is
`resource.<key>`, `metric.<name>`, or whatever your app chooses.
