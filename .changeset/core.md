---
"@flowpanel/core": minor
---

The config surface now declares only what the runtime reads: options and public API that no surface reached are gone, and `auth.session` receives the request. Column formatting and the fail-closed scope rule each have one definition instead of a copy per package.
