---
"@flowpanel/react": patch
---

Read and write the theme preference through the browser's own `window.localStorage`
instead of a bare `localStorage` identifier. Node defines a global of that name from
20.4 onward, so a server render could believe storage was available.
