import type { FlowPanelConfig } from "../config/schema";
import type { ResourceAdapter, ResolvedResource } from "../resource/types";
import type { Session } from "../types/config";
import type { SqlExecutor } from "../types/db";

export interface FlowPanelContext {
  config: FlowPanelConfig;
  db: SqlExecutor;
  session: Session | null;
  req: Request;

  // v2 resource fields
  resources?: Record<string, ResolvedResource>;
  resourceAdapter?: ResourceAdapter;
}
