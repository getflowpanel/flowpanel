import type { FlowpanelResult, FlowpanelWarning, FlowpanelWarningCode } from "../types/result.js";

export type MutationPipelineStage =
  | "transport"
  | "auth"
  | "admin_access"
  | "rate_limit"
  | "route"
  | "resource_access"
  | "operation_access"
  | "writable"
  | "load_current"
  | "field_access"
  | "prepare_input"
  | "execute";

export interface PostCommitEffect {
  code: FlowpanelWarningCode;
  run: () => void | Promise<void>;
}

export interface MutationPipeline<Identity, Route, Current, AuthorizedInput, Input, Output> {
  requestId: string;
  transport: () => void | Promise<void>;
  authenticate: () => Identity | Promise<Identity>;
  authorizeAdmin: (identity: Identity) => void | Promise<void>;
  rateLimit: (identity: Identity) => void | Promise<void>;
  resolveRoute: () => Route | Promise<Route>;
  authorizeResource: (identity: Identity, route: Route) => void | Promise<void>;
  authorizeOperation: (identity: Identity, route: Route) => void | Promise<void>;
  assertWritable: (identity: Identity, route: Route) => void | Promise<void>;
  loadCurrent: (identity: Identity, route: Route) => Current | Promise<Current>;
  authorizeFields: (
    identity: Identity,
    route: Route,
    current: Current,
  ) => AuthorizedInput | Promise<AuthorizedInput>;
  prepareInput: (
    input: AuthorizedInput,
    identity: Identity,
    route: Route,
    current: Current,
  ) => Input | Promise<Input>;
  execute: (
    input: Input,
    identity: Identity,
    route: Route,
    current: Current,
  ) => Output | Promise<Output>;
  effects?: readonly PostCommitEffect[];
  onEffectError?: (code: FlowpanelWarningCode, error: unknown) => void | Promise<void>;
}

/** One ordered mutation runner shared by generated, HTTP, and headless surfaces. */
export async function runMutationPipeline<Identity, Route, Current, AuthorizedInput, Input, Output>(
  pipeline: MutationPipeline<Identity, Route, Current, AuthorizedInput, Input, Output>,
): Promise<FlowpanelResult<Output>> {
  await pipeline.transport();
  const identity = await pipeline.authenticate();
  await pipeline.authorizeAdmin(identity);
  await pipeline.rateLimit(identity);
  const route = await pipeline.resolveRoute();
  await pipeline.authorizeResource(identity, route);
  await pipeline.authorizeOperation(identity, route);
  await pipeline.assertWritable(identity, route);
  const current = await pipeline.loadCurrent(identity, route);
  const authorized = await pipeline.authorizeFields(identity, route, current);
  const input = await pipeline.prepareInput(authorized, identity, route, current);
  const data = await pipeline.execute(input, identity, route, current);

  const warnings: FlowpanelWarning[] = [];
  for (const effect of pipeline.effects ?? []) {
    try {
      await effect.run();
    } catch (error) {
      warnings.push({ code: effect.code, message: "A post-commit effect failed." });
      await pipeline.onEffectError?.(effect.code, error);
    }
  }

  return {
    ok: true,
    data,
    meta: {
      requestId: pipeline.requestId,
      ...(warnings.length > 0 ? { warnings } : {}),
    },
  };
}
