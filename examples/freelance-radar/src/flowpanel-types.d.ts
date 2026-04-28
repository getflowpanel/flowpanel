/**
 * Type augmentation — makes `ctx.db` / `ctx.session` typed across every
 * FlowPanel callback, so you never write `const d = ctxDb as typeof db`.
 *
 * Adjust these types once to match your project's db client + session.
 */

import type { AdminSession } from "./lib/auth";

declare module "@flowpanel/core" {
  interface FlowPanelTypes {
    db: typeof import("./db/client").db;
    session: AdminSession | null;
  }
}
