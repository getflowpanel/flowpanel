# with-clerk

The smallest FlowPanel admin behind Clerk: two resources, one dashboard, and `auth: withClerk({ requireRole: "admin" })` in `src/flowpanel.config.ts`.

## Run it

Node.js 22+, pnpm and Docker. From the repository root:

```bash
pnpm install
pnpm --filter "./packages/**" build
cp examples/with-clerk/.env.example examples/with-clerk/.env.local
# set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY
pnpm --filter with-clerk docker:up
pnpm --filter with-clerk db:push
pnpm --filter with-clerk db:seed
pnpm --filter with-clerk dev
```

Sign up at [http://localhost:3000](http://localhost:3000), then in the Clerk dashboard:

1. Under **Sessions → Customize session token**, add:
   ```json
   { "publicMetadata": "{{user.public_metadata}}" }
   ```
2. Set your user's `publicMetadata.role` to `"admin"`.
3. Open `/admin`.

Without the role, FlowPanel redirects to `forbiddenUrl`. Postgres listens on port `54330`.
