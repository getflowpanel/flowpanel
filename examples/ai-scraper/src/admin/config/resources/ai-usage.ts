import { resource } from "@flowpanel/kit";
import * as schema from "@/src/db/schema";
import { sandboxResourcePolicy } from "@/src/demo/sandbox/scope";
import { modelLabel } from "@/src/lib/ai-models";
import { money } from "../../format";

export const aiUsage = resource(schema.aiUsage, {
  ...sandboxResourcePolicy(schema.aiUsage.sandboxId),
  name: "ai_usage",
  label: "AI usage",
  icon: "sparkles",
  hidden: true,
  columns: [
    {
      field: "customerId",
      label: "Customer",
      reference: { resource: "customers", labelField: "company" },
    },
    "provider",
    { field: "model", label: "Model", render: (c) => modelLabel(c.model) },
    { field: "task", label: "Task", format: "badge" },
    { field: "tokensIn", label: "Tokens in", align: "right", format: "number" },
    { field: "tokensOut", label: "Tokens out", align: "right", format: "number" },
    { field: "costCents", label: "Cost", align: "right", format: money },
    { field: "createdAt", label: "Created" },
  ],
  filters: [
    {
      field: "provider",
      type: "select",
      options: [
        { label: "OpenAI", value: "openai" },
        { label: "Anthropic", value: "anthropic" },
        { label: "Google", value: "google" },
      ],
    },
    {
      field: "task",
      type: "select",
      options: [
        { label: "Match", value: "match" },
        { label: "Extract", value: "extract" },
      ],
    },
    { field: "createdAt", type: "daterange", label: "Date" },
  ],
  defaultSort: { field: "createdAt", dir: "desc" },
  create: { disabled: true },
});
