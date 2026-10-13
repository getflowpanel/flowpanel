import { enumOf, resource } from "@flowpanel/kit";
import * as schema from "@/db/schema";

const Status = enumOf(schema.runStatus.enumValues, { queued: "Queued", running: "Running", success: "Success", failed: "Failed" });

export const runs = resource(schema.runs, {
  columns: [
    "id",
    { field: "monitorId", label: "Monitor", reference: { resource: "monitors", labelField: "name" } },
    { field: "status", format: Status.format },
    "pagesCrawled",
    "durationMs",
    { field: "startedAt", format: { kind: "date", time: true } },
    { field: "finishedAt", format: { kind: "date", time: true } },
    "error",
  ],
  filters: [{ field: "status", type: "select" }],
  defaultSort: { field: "startedAt", dir: "desc" },
});
