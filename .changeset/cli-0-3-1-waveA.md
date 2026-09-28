---
"@flowpanel/cli": patch
---

The Drizzle config template registers `schema` on `FlowpanelTypes`, and the better-auth session module registers `typeof auth.$Infer.Session`, so a new admin types its resources and its session with no hand registry.
