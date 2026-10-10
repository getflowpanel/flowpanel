import { enumOf, resource } from "@flowpanel/kit";
import * as schema from "@/db/schema";

const Plan = enumOf(schema.planTier.enumValues, { free: "Free", starter: "Starter", pro: "Pro", business: "Business" });
const Status = enumOf(schema.accountStatus.enumValues, {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past due",
  canceled: "Canceled",
});

export const customers = resource(schema.customers, {
  columns: [
    "id",
    "email",
    "name",
    "company",
    { field: "plan", format: Plan.format },
    { field: "status", format: Status.format },
    "mrr",
    { field: "churned", format: "boolean" },
    { field: "createdAt", format: { kind: "date", time: true } },
    { field: "lastSeenAt", format: { kind: "date", time: true } },
    { field: "deletedAt", format: { kind: "date", time: true } },
  ],
  search: ["email", "name"],
  filters: [{ field: "plan", type: "select" }, { field: "status", type: "select" }],
  defaultSort: { field: "createdAt", dir: "desc" },
});
