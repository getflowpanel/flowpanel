import { resource } from "@flowpanel/kit";
import { money } from "@/src/admin/format";
import * as schema from "@/src/db/schema";
import { sandboxResourcePolicy } from "@/src/demo/sandbox/scope";
import { modelLabel } from "@/src/lib/ai-models";
import { Provider, Task } from "../enums";

export const aiUsage = resource(schema.aiUsage, {
  ...sandboxResourcePolicy(schema.aiUsage.sandboxId),
  label: "AI usage",
  icon: "sparkles",
  hidden: true,
  columns: [
    {
      field: "customerId",
      label: "Customer",
      reference: { resource: "customers", labelField: "company" },
    },
    { field: "provider", format: Provider.format },
    { field: "model", label: "Model", render: (c) => modelLabel(c.model) },
    { field: "task", format: Task.format },
    { field: "tokensIn", label: "Tokens in", align: "right", format: "number" },
    { field: "tokensOut", label: "Tokens out", align: "right", format: "number" },
    { field: "costCents", label: "Cost", align: "right", format: money },
    { field: "createdAt", label: "Created" },
  ],
  filters: [
    { field: "provider", type: "select" },
    { field: "task", type: "select" },
    { field: "createdAt", type: "daterange", label: "Date" },
  ],
  defaultSort: { field: "createdAt", dir: "desc" },
  create: { disabled: true },
});
