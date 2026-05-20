---
"@flowpanel/cli": patch
---

`flowpanel init` Drizzle scaffold now includes the `FlowpanelTypes` module augmentation (`declare module "@flowpanel/core" { interface FlowpanelTypes { db: typeof db } }`) — first-touch users get typed `ctx.db` immediately. Both Drizzle and Prisma scaffolds now default to `realtime: { driver: "memory" }` so the SSE example works out of the box.
