---
"@flowpanel/next": patch
---

Hold every write and render path to the rules the main paths already follow.

- Inline cell edits validate against the resource's declared `schema`, exactly
  like form edits and JSON `PATCH`; previously only the adapter-inferred schema
  applied to them.
- The list page's create drawer offers only writable columns, matching the
  standalone create page; generated and primary-key columns no longer appear
  in the form the server would then reject.
- The audit `targetId` and realtime `id` of a create honour `rowKey` instead
  of assuming a column named `id`.
- `RestoreButton` URL-encodes the resource and id like every other client
  call, and reads the error message from the result envelope.
- The SSE stream route maps failures to their real status — a crashing session
  provider is a 500 and a rate limit a 429, reported through `hooks.onError`,
  instead of a silent 403.
- Saving a view under an existing name replaces that view instead of creating
  a duplicate that rendered with colliding keys and deleted in pairs.
- Body rows carry `aria-rowindex` offset past the header row and the table
  declares `aria-rowcount`, so screen readers announce absolute positions
  across pages.
