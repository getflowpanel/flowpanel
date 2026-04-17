import type { FlowPanelContext } from "./context";

/**
 * Shape of the tRPC instance passed to middleware and procedure factories.
 * We don't import tRPC's internal generic types directly because they're
 * deeply nested. This interface documents the contract.
 */
export interface FlowPanelTRPC {
  middleware: (fn: MiddlewareFn) => unknown;
  procedure: unknown;
  router: (routes: Record<string, unknown>) => unknown;
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
 * Context available after auth middleware runs.
 */
export interface AuthedContext extends FlowPanelContext {
  session: { userId: string; role: string };
}
