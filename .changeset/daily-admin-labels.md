---
"@flowpanel/core": minor
"@flowpanel/react": patch
"@flowpanel/next": patch
"@flowpanel/kit": patch
---

Add a serializable Russian chrome preset and configurable navigation, table,
calendar and saved-view labels. Calendar formatting now uses an explicit locale
consistently on server and client. Preserve active navigation on detail routes.
Saved views retain unsaved input and report storage failures instead of claiming
success when browser storage rejects a write.
