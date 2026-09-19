---
"@flowpanel/core": minor
"@flowpanel/next": patch
"@flowpanel/adapter-drizzle": minor
"@flowpanel/adapter-prisma": minor
"@flowpanel/cli": minor
---

A widget query can ask the database a question the ORM will not phrase. `ctx.sql`
is a tagged template, and deliberately has no string-taking form: the literal
parts and the interpolated values reach the adapter apart, and every value is
bound as a parameter, so a value out of a search box cannot end the statement and
start another one. A `Date` binds as ISO-8601 text and a `bigint` as decimal text,
so one template runs unchanged on Postgres, MySQL and SQLite. Rows come back as
plain objects with the driver's own shape normalised away — node-postgres answers
`{ rows }`, postgres-js and the SQLite drivers the array, mysql2 `[rows, fields]`.
A free-form statement carries no column types to consult, so every string shaped
exactly like a zoneless `YYYY-MM-DD HH:mm:ss` comes back as a UTC `Date`, which is
what the drivers returning them mean; cast a text column in the query to keep it a
string. An adapter that implements no `sql` names itself in the error rather than
failing somewhere further in.

`ctx.sql` runs exactly the statement you write, and the reference says so next to
the API: no tenant scope, no access rule and no soft-delete filter are added, and a
multi-tenant admin puts that predicate in the statement itself. Both adapters take
`parseDates: false` for a host whose own text column holds timestamp-shaped strings
that a `select *` gives no place to cast.

`ctx.count(resource, where)` answers how many rows match without reading them. It
goes through the same role, access and tenant-scope checks as any other
cross-resource read, so a resource the session may not read counts zero instead of
leaking a total, and soft-deleted rows are excluded. The new `count` adapter
capability answers directly when there is no tenant predicate to apply — it takes
a filter map, not a scope binding — and a scoped resource is counted through the
authorized list path with an empty projection instead. Which path runs never
changes the answer: `requireRole`, `access` and `fieldAccess` are checked before
either, counting by a field the role cannot read answers zero rather than becoming
an oracle over its values, and an `undefined` filter value narrows to nothing
instead of widening to every row. `sanitizeSqlParams` and
`parseSqlRows` ship from core so a third-party adapter behaves like the two
shipped ones.

`withBetterAuth` joins the auth presets. It reads the session from the request
FlowPanel is serving, so cookie sessions work the same in a page render and an API
route. A provider that throws, or answers with anything that is not a session
carrying a `user` object, is treated as nobody signed in rather than as somebody
unreadable. Its `role` may return a promise — the guide shows the role coming from
your own table rather than from whatever the session happens to carry.

`flowpanel init` now reads `package.json` for better-auth, NextAuth, Clerk and
Lucia, and says which one it recognised. An auth module that exports its provider's
instance rather than a `getSession` used to stop the install; it is now bridged
through the matching preset in a generated `server/lib/flowpanel-session.ts`, with
the config pointed at it. A module that already exports `getSession` is left
untouched, and a project with no recognised provider still gets the closed
`getSession` adapter.
