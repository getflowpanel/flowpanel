export type Status = "running" | "succeeded" | "failed";

const STATUS_CONFIG: Record<Status, { label: string; bg: string; color: string }> = {
  running: { label: "Running", bg: "rgba(245,158,11,0.15)", color: "#f59e0b" },
  succeeded: { label: "Succeeded", bg: "rgba(16,185,129,0.15)", color: "#10b981" },
  failed: { label: "Failed", bg: "rgba(239,68,68,0.15)", color: "#ef4444" },
};

export function StatusTag({ status, loading }: { status: Status; loading?: boolean }) {
  if (loading) {
    return (
      <span
        className="fp-skeleton"
        style={{ display: "inline-block", width: 70, height: 20, borderRadius: 4 }}
      />
    );
  }

  const cfg = STATUS_CONFIG[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 6,
        background: cfg.bg,
        color: cfg.color,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.03em",
      }}
      aria-label={`Status: ${status}`}
    >
      <span
        style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color }}
        aria-hidden={true}
      />
      {cfg.label}
    </span>
  );
}
