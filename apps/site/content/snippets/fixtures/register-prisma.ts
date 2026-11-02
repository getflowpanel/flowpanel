import type { getSession } from "@/lib/auth";
import type { prisma } from "@/lib/prisma";

declare module "@flowpanel/kit" {
  interface FlowpanelTypes {
    db: typeof prisma;
    session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
  }
  interface FlowpanelResources {
    users: import("@prisma/client").User;
    orders: import("@prisma/client").Order;
  }
}
