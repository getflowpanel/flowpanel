import type { Tone } from "@flowpanel/kit";

export const PLANS = [
  { label: "Free", value: "free" },
  { label: "Starter", value: "starter" },
  { label: "Pro", value: "pro" },
  { label: "Business", value: "business" },
];

export const STATUSES = [
  { label: "Active", value: "active" },
  { label: "Trialing", value: "trialing" },
  { label: "Past due", value: "past_due" },
  { label: "Canceled", value: "canceled" },
];

export const STATUS_TONES: Record<string, Tone> = {
  active: "ok",
  trialing: "warn",
  past_due: "err",
  canceled: "muted",
};

export function labelOf(options: { label: string; value: string }[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}
