import { type DetailTab, related, resource, table } from "@flowpanel/core";
import { expectAssignable, expectError } from "tsd";

expectAssignable<DetailTab<{ id: number; email: string }>>(related("visits"));
related("visits", {
  by: "userId",
  hide: ["userId"],
  sort: { field: "startedAt", dir: "desc" },
  pageSize: 50,
  count: false,
});
expectError(related("visits", { by: "usrId" }));
expectError(related("visits", { sort: { field: "startedat", dir: "desc" } }));
expectError(related("vists"));

declare const users: { $inferSelect: { id: number; email: string } };
resource(users, {
  detail: {
    tabs: [
      related("visits"),
      { ...related("visits"), key: "seen", label: "Seen" },
      { key: "v", label: "V", resource: "visits", by: "userId", count: true, pageSize: 10 },
    ],
  },
});

table({ resource: "visits", where: (c) => ({ userId: c.id }), range: "startedAt" });
