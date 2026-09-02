# with-clerk — FlowPanel + Clerk

Minimal example showing how `withClerk({ requireRole: "admin" })` wires Clerk
auth into a FlowPanel admin. Two resources (`users`, `posts`), one overview
dashboard, no application-specific noise — the point is to show that the
Clerk integration is a single line in `src/flowpanel.config.ts`.

## What's in it

- `src/flowpanel.config.ts` — the centerpiece: `auth: withClerk({ requireRole: "admin" })`.
- `proxy.ts` — `clerkMiddleware()` so `auth()` resolves on the server.
- `app/layout.tsx` — `ClerkProvider` at the root.
- `app/page.tsx` — `await auth()` redirects signed-in users to `/admin`; `<SignedOut>` shows `<SignIn>`.
- `app/admin/[[...slug]]/page.tsx` — mounts FlowPanel.
- `src/db/schema.ts` — `users` + `posts` (Drizzle / Postgres).

## Run it

Prerequisites: Node.js 22+, pnpm, and Docker. Run every command from the
repository root.

```bash
# 1. Workspace — the example imports the packages' built `dist/`
pnpm install
pnpm --filter "./packages/**" build

# 2. Clerk
cp examples/with-clerk/.env.example examples/with-clerk/.env.local
# then fill in NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY

# 3. Database
pnpm --filter with-clerk docker:up
pnpm --filter with-clerk db:push
pnpm --filter with-clerk db:seed

# 4. App
pnpm --filter with-clerk dev
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
