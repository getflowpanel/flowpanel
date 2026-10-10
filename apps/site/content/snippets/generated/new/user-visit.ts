import { enumOf, resource } from "@flowpanel/kit";
import * as schema from "@/db/schema";

const Surface = enumOf(schema.activitySurface.enumValues, { web: "Web", tma: "Tma" });

export const userVisit = resource(schema.userVisit, {
  hidden: true,
  columns: [
    "id",
    { field: "userId", label: "User", reference: { resource: "user", labelField: "email" } },
    { field: "surface", format: Surface.format },
    { field: "startedAt", format: { kind: "date", time: true } },
    "touches",
  ],
  filters: [{ field: "surface", type: "select" }],
  defaultSort: { field: "startedAt", dir: "desc" },
});
