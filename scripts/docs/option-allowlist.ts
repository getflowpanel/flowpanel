export interface OptionAllowlistEntry {
  type: string;
  member: string;
  reason: string;
}

export const OPTION_ALLOWLIST: OptionAllowlistEntry[] = [
  {
    type: "InferRow",
    member: "$inferSelect",
    reason: "Drizzle's own table brand, matched by a conditional type and never read at runtime.",
  },
];
