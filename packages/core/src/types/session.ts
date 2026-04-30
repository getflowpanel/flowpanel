export type Session = Record<string, unknown>;

export type Scope = Record<string, unknown> | null;

export interface ScopeContext {
  req: Request;
  session: Session | null;
}
