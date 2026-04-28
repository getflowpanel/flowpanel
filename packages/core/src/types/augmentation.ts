/**
 * Module-level type augmentation for FlowPanel.
 *
 * Users declare the shape of their DB client (and optionally their session)
 * once in their project root — then every `ctx.db` in every resource
 * callback is typed automatically. No casts, no generic repetition.
 *
 * @example
 * ```ts
 * // src/flowpanel-types.d.ts (anywhere in your project)
 * import type { db } from "./db/client";
 * import type { MySession } from "./lib/auth";
 *
 * declare module "@flowpanel/core" {
 *   interface FlowPanelTypes {
 *     db: typeof db;
 *     session: MySession;
 *   }
 * }
 * ```
 *
 * After that, `run: async ({ db, session }) => { ... }` works with full
 * type inference — no `const d = ctxDb as typeof db` required.
 */

/**
 * Must be an `interface` — NOT a type alias. Type aliases cannot be merged
 * through `declare module { interface ... }` from user projects, so this is
 * load-bearing. Do not "clean up" to `type FlowPanelTypes = {}`.
 */
// biome-ignore lint/suspicious/noEmptyInterface: canonical augmentable base — the user merges fields in their own project
// biome-ignore lint/complexity/noBannedTypes: same reason
export interface FlowPanelTypes {}

/** Resolve the user's declared `db` type, falling back to `unknown`. */
export type FpDb = FlowPanelTypes extends { db: infer D } ? D : unknown;

/** Resolve the user's declared `session` type, falling back to `unknown`. */
export type FpSession = FlowPanelTypes extends { session: infer S } ? S : unknown;
