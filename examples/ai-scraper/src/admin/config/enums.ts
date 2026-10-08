import { enumOf } from "@flowpanel/kit";
import {
  accountStatus,
  aiProvider,
  aiTask,
  invoiceStatus,
  matchStatus,
  monitorStatus,
  planTier,
  runStatus,
  scheduleKind,
  stockStatus,
} from "@/src/db/schema";
import { MARKETPLACE_LABELS } from "@/src/demo/data/marketplaces";
import { MARKETPLACES } from "@/src/demo/data/types";

export const Plan = enumOf(planTier.enumValues, {
  free: ["Free", "muted"],
  starter: ["Starter", "info"],
  pro: ["Pro", "accent"],
  business: ["Business", "accent"],
});

export const AccountStatus = enumOf(accountStatus.enumValues, {
  active: ["Active", "ok"],
  trialing: ["Trialing", "info"],
  past_due: ["Past due", "err"],
  canceled: ["Canceled", "muted"],
});

export const MonitorStatus = enumOf(monitorStatus.enumValues, {
  active: ["Active", "ok"],
  paused: ["Paused", "warn"],
  error: ["Error", "err"],
});

export const Schedule = enumOf(scheduleKind.enumValues, {
  manual: "Manual",
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
});

export const RunStatus = enumOf(runStatus.enumValues, {
  queued: ["Queued", "muted"],
  running: ["Running", "info"],
  success: ["Success", "ok"],
  failed: ["Failed", "err"],
});

export const InvoiceStatus = enumOf(invoiceStatus.enumValues, {
  open: ["Open", "warn"],
  paid: ["Paid", "ok"],
  void: ["Void", "err"],
  refunded: ["Refunded", "muted"],
});

export const Stock = enumOf(stockStatus.enumValues, {
  in_stock: ["In stock", "ok"],
  low_stock: ["Low stock", "warn"],
  out_of_stock: ["Out of stock", "err"],
});

export const MatchStatus = enumOf(matchStatus.enumValues, {
  confirmed: ["Confirmed", "ok"],
  needs_review: ["Needs review", "warn"],
  rejected: ["Rejected", "muted"],
});

export const Provider = enumOf(aiProvider.enumValues, {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
});

export const Task = enumOf(aiTask.enumValues, { match: "Match", extract: "Extract" });

export const Site = enumOf(MARKETPLACES, MARKETPLACE_LABELS);
