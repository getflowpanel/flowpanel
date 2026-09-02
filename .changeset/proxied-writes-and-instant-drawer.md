---
"@flowpanel/next": patch
"@flowpanel/react": patch
---

Accept writes from admins behind a reverse proxy, and stop paying for a server round-trip on every drawer interaction.

The same-origin guard compared the browser's `Origin` against `req.url`, which behind a proxy names the internal host — so every write from a deployed admin was rejected as cross-origin. It now resolves the origin the browser actually addressed from the forwarded headers, the way Next.js resolves it for Server Actions; `browserOrigin` is exported for routes that need the same answer.

Opening the drawer or switching one of its tabs pushed a new route, which re-rendered the whole list on the server before the drawer could even start loading its own payload. Those writes now go through the History API: the URL stays shareable and Back still closes the drawer, but a tab switch costs nothing at all, and the drawer starts fetching the moment it is clicked.

Enter on a table row now claims the key. It used to open the drawer and let the browser hand the same keystroke to the newly focused control inside it, which closed the drawer again — invisible only because the drawer took a server round-trip to appear.
