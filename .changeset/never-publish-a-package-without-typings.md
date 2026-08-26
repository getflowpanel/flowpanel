---
"@flowpanel/next": patch
"@flowpanel/react": patch
"@flowpanel/charts": patch
"@flowpanel/core": patch
---

Stop the build racing itself into a package with no typings.

`@flowpanel/charts`, `@flowpanel/next` and `@flowpanel/react` each build two
tsup configs concurrently, and in each the first config declared `clean: true`.
Whichever finished first had its output deleted by the other — which is how
`@flowpanel/next` came to ship `client.js` with no `client.d.ts`, leaving
`@flowpanel/kit` unable to typecheck its own `./next/client` re-export. The
build now clears `dist` once before tsup starts, the way `@flowpanel/core`
already did.

`compile-admin.ts` also grew past the 300-line cap, so its five configuration
validators now live in `compiler/validate-config.ts`.
