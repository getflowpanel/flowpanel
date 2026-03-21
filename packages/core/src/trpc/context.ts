import type { FlowPanelConfig } from "../config/schema.js";
import type { SqlExecutor } from "../types/db.js";
import type { Session } from "../types/config.js";

export interface FlowPanelContext {
  config: FlowPanelConfig;
  db: SqlExecutor;
  session: Session | null;
  req: Request;
}
