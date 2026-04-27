import type { FlowPanelContext } from "./context";

/**
 * Shape of the tRPC instance passed to middleware and procedure factories.
 * We don't import tRPC's internal generic types directly because they're
 * deeply nested. This interface documents the contract.
 */
export interface FlowPanelTRPC {
  middleware: (fn: MiddlewareFn) => unknown;
  procedure: unknown;
  // biome-ignore lint/suspicious/noExplicitAny: tRPC's router() accepts any record shape; the return is itself an opaque tRPC object.
  router: (routes: Record<string, unknown>) => any;
}

export type MiddlewareFn = (opts: {
  ctx: FlowPanelContext;
  next: NextFn;
  path: string;
}) => Promise<unknown>;

export type NextFn = (opts?: { ctx: Partial<FlowPanelContext> }) => Promise<{ ok: boolean }>;

/**
 * Dependencies injected into every procedure factory.
 */
export interface ProcedureFactoryDeps {
  t: FlowPanelTRPC;
  authedProcedure: unknown;
}

/**
 * Context available after auth middleware runs — session is guaranteed
 * non-null. Use this in procedures reached via `authedProcedure`.
 */
import type { Session } from "../types/config";
export interface AuthedContext extends FlowPanelContext {
  session: Session;
}
