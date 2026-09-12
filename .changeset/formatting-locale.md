---
"@flowpanel/core": minor
"@flowpanel/next": patch
"@flowpanel/react": minor
---

`formatting` decides how the admin renders values: `locale` for the `number` and
`money` column formats and the date shape, `currency` for a `money` column that
names none, and `timeZone` for what the server and the first paint show before the
reader's own zone takes over. It is one config entry, honoured by server-rendered
cells and by the browser alike, so a Russian admin no longer reads `1,774` and
`$12.00`.

Nothing changes for an admin that configures none of it: numbers keep `en-US`
grouping and timestamps keep the sortable `YYYY-MM-DD HH:mm` shape.
