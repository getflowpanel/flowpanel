import type { FlowPanelConfig } from "../config/schema";
import type { Session } from "../types/config";
import type { SqlExecutor } from "../types/db";

export interface FlowPanelContext {
  config: FlowPanelConfig;
  db: SqlExecutor;
  session: Session | null;
  req: Request;
}
