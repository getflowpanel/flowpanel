# with-clerk — FlowPanel + Clerk

Minimal example showing how `withClerk({ requireRole: "admin" })` wires Clerk
auth into a FlowPanel admin. Two resources (`users`, `posts`), one overview
dashboard, no application-specific noise — the point is to show that the
Clerk integration is a single line in `flowpanel.config.ts`.

## What's in it

- `flowpanel.config.ts` — the centerpiece: `auth: withClerk({ requireRole: "admin" })`.
- `proxy.ts` — `clerkMiddleware()` so `auth()` resolves on the server.
- `app/layout.tsx` — `ClerkProvider` at the root.
- `app/page.tsx` — `<SignedIn>` redirects to `/admin`; `<SignedOut>` shows `<SignIn>`.
- `app/admin/[[...slug]]/page.tsx` — mounts FlowPanel.
- `src/db/schema.ts` — `users` + `posts` (Drizzle / Postgres).

## Run it

```bash
# 1. Clerk
cp .env.example .env.local           # then fill in your Clerk keys

# 2. Database
pnpm docker:up
pnpm db:push
pnpm db:seed

# 3. App
pnpm dev
```

Then sign up in your local app (port 3000). In the Clerk dashboard:

1. **Customize the session token** — Clerk session tokens don't carry
   `publicMetadata` by default, and `withClerk` reads
   `sessionClaims.publicMetadata.role`. Go to **Sessions → Customize session
   token** and add:
   ```json
   { "publicMetadata": "{{user.public_metadata}}" }
   ```
2. Find your user and set `publicMetadata.role` to `"admin"`.
3. Visit `/admin` — that's it.

Without `role=admin`, FlowPanel will redirect to `forbiddenUrl` (or `/`).

## Port

Postgres is exposed on `54330` so it doesn't collide with `ai-scraper`'s
`54329` if you run both.
