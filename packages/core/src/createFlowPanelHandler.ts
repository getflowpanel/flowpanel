/**
 * createFlowPanelHandler — one-liner tRPC mount for the Next.js App Router.
 *
 * Before:
 *   const t = initTRPC.context<Ctx>().create();
 *   const appRouter = t.router({ flowpanel: createFlowPanelRouter({ t, config: fp.getRouterConfig(), getRequest: ... })});
 *   const handler = (req: Request) => fetchRequestHandler({...});
 *   export { handler as GET, handler as POST };
 *
 * After:
 *   export const { GET, POST } = createFlowPanelHandler(flowpanel);
 *
 * The factory is strictly the boilerplate wrapper; users who need a custom
 * context or a non-fetch transport reach for `createFlowPanelRouter` directly.
 */

import { initTRPC } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { FlowPanel, FlowPanelRouterConfig } from "./defineFlowPanel";
import { createFlowPanelRouter } from "./trpc";

/** Minimal context threaded through the tRPC router. */
interface HandlerContext {
  req: Request;
}

export interface FlowPanelHandlerOptions {
  /** Endpoint path prefix — must match the Next.js route dir. Default "/api/trpc". */
  endpoint?: string;
  /** Called for every uncaught error during request handling. */
  onError?: (err: unknown) => void;
}

export type FlowPanelHandler = (req: Request) => Response | Promise<Response>;

/**
 * Build a tRPC fetch handler pre-wired with the FlowPanel router.
 *
 * Returns `{ GET, POST, router }`. `GET`/`POST` are the Next.js App Router
 * verbs; `router` is the tRPC router reference exposed so the client can
 * type itself: `export type AppRouter = typeof handler.router`.
 */
export function createFlowPanelHandler(
  // biome-ignore lint/suspicious/noExplicitAny: FlowPanel<TConfig> — TConfig is invariant here
  flowpanel: Pick<FlowPanel<any>, "getRouterConfig">,
  options: FlowPanelHandlerOptions = {},
) {
  const { endpoint = "/api/trpc", onError } = options;

  const t = initTRPC.context<HandlerContext>().create();
  const routerConfig: FlowPanelRouterConfig = flowpanel.getRouterConfig();

  const appRouter = t.router({
    flowpanel: createFlowPanelRouter<HandlerContext>({
      t,
      config: routerConfig,
      getRequest: (ctx) => ctx.req,
    }),
  });

  const handler: FlowPanelHandler = (req) =>
    fetchRequestHandler({
      endpoint,
      req,
      router: appRouter,
      createContext: () => ({ req }),
      ...(onError ? { onError: ({ error }) => onError(error) } : {}),
    });

  return { GET: handler, POST: handler, router: appRouter };
}
