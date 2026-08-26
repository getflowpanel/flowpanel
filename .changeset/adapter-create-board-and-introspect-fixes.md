---
"@flowpanel/adapter-prisma": minor
"@flowpanel/adapter-drizzle": minor
"@flowpanel/adapter-bullmq": patch
---

Fix scoped create, the bull-board token gate and repeated introspection in the adapters.

`prismaAdapter.create` passed the resolved scope predicate straight to Prisma as
`data`. That only happens to work for plain equality scopes: a scope returning
`{ companyId: { in: [...] } }`, `{ OR: [...] }` or any other filter operator
produced invalid insert data and every create failed with a raw Prisma
validation error. Create now resolves insert data separately from the where
predicate — equality scope keys are written into the new row (still overriding
client input, so a hand-crafted foreign tenant id cannot win) and a scope that
contributes a filter rather than a single value is refused up front with a
`FlowpanelAccessError` naming the key and the fix, mirroring how the drizzle
adapter refuses a create that lands outside its tenant scope.

`startBoardServer` required a token on *every* request, but only the iframe's
document URL carries `?token=`. bull-board is a SPA, so its own scripts, styles
and `/api/queues` polls arrived without one, got 401, and the embedded board
rendered blank for every queue even with a correct token. A valid token now
mints an HttpOnly, SameSite=Lax session cookie that authorizes the rest of the
board session; the cookie value is derived from the token, so the raw secret
never lands in a cookie jar and the value stays valid across restarts and
replicas. A missing, wrong or forged credential still gets nothing, and
`auth.token` remains required — there is still no unauthenticated mode.

`introspect()` rebuilt full column metadata on every call in both adapters, and
a single list render calls it repeatedly — resource exposure, the list page
twice, once per reference column and once per autocomplete keystroke, with an
extra linear DMMF scan on Prisma. Both adapters now memoize per ref (a `WeakMap`
on the drizzle table, a `WeakMap` on the DMMF holding a per-model `Map` on
Prisma). Schemas are static for a process lifetime, so the entry is reused for
the whole process; the returned introspection and its columns are frozen because
one object is now shared by every caller.
