import { resource } from "@flowpanel/kit";
import * as schema from "@/src/db/schema";
import { formatDate, money } from "../format";

export const aiUsage = resource(schema.aiUsage, {
  label: "AI usage",
  columns: [
    {
      field: "userId",
      label: "Customer",
      reference: { resource: "users", labelField: "email" },
    },
    "provider",
    "model",
    { field: "task", label: "Task", format: "badge" },
    { field: "tokensIn", label: "Tokens in", align: "right", format: "number" },
    { field: "tokensOut", label: "Tokens out", align: "right", format: "number" },
    { field: "costCents", label: "Cost", align: "right", format: money },
    { field: "createdAt", label: "Created", render: (c) => formatDate(c.createdAt) },
  ],
  filters: [
    {
      field: "provider",
      type: "select",
      label: "Provider",
      options: [
        { label: "OpenAI", value: "openai" },
        { label: "Anthropic", value: "anthropic" },
        { label: "Google", value: "google" },
      ],
    },
    {
      field: "task",
      type: "select",
      label: "Task",
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
