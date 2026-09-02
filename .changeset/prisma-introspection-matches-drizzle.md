---
"@flowpanel/adapter-prisma": patch
---

Report database-generated ids as such, like the Drizzle introspector does.

An id with a default (autoincrement, cuid, uuid) is now
`generated: true, writableOnCreate: false`, so generated forms stop offering a
primary key the database will assign itself. Non-id defaults stay writable.
