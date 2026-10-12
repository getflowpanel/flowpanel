import type { db } from "@/db";
import type * as schema from "@/db/schema";
import type { getSession } from "@/lib/auth";

declare module "@flowpanel/kit" {
  interface FlowpanelTypes {
    db: typeof db;
    schema: typeof schema;
    session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
  }
}
