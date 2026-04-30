import { cn } from "../lib/cn.js";

export type StatusTone = "ok" | "warn" | "err" | "muted";

export function StatusDot({ tone = "ok", className }: { tone?: StatusTone; className?: string }) {
  const colorClass = {
    ok: "bg-fp-ok",
    warn: "bg-fp-warn",
    err: "bg-fp-err",
    muted: "bg-fp-text-3",
  }[tone];
  return (
    <span aria-hidden className={cn("inline-block h-2 w-2 rounded-full", colorClass, className)} />
  );
}
