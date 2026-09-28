import type { FlowpanelTypes } from "./registry";

/** The signed-in session: the registered `FlowpanelTypes["session"]`, else any record. */
export type Session = FlowpanelTypes extends { session: infer S extends object }
  ? S
  : Record<string, unknown>;

export type Scope = Record<string, unknown> | null;

export interface ScopeContext {
  req: Request;
  session: Session | null;
}
