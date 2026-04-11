import { Badge } from "./ui/badge.js";
import { Skeleton } from "./ui/skeleton.js";

export type Status = "running" | "succeeded" | "failed";

const STATUS_BADGE: Record<
  Status,
  { label: string; variant: "ok" | "err" | "warn" | "running" | "muted" }
> = {
  running: { label: "Running", variant: "running" },
  succeeded: { label: "Succeeded", variant: "ok" },
  failed: { label: "Failed", variant: "err" },
};

export function StatusTag({ status, loading }: { status: Status; loading?: boolean }) {
  if (loading) {
    return <Skeleton className="fp:inline-block fp:h-5 fp:w-[70px] fp:rounded" />;
  }

  const cfg = STATUS_BADGE[status];
  return (
    <Badge variant={cfg.variant} aria-label={`Status: ${status}`}>
      {cfg.label}
    </Badge>
  );
}
