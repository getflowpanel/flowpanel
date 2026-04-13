import { useLocale } from "../locale/LocaleContext";

export type Status = "running" | "succeeded" | "failed";

const STATUS_STYLE: Record<Status, { bg: string; color: string }> = {
  // Colors are bright enough to meet WCAG AA 4.5:1 against any dark background,
  // including when the semi-transparent tag background is composited on top of
  // a selected-row highlight (--fp-surface-2).
  running: { bg: "rgba(251,191,36,0.15)", color: "#fbbf24" }, // amber-400
  succeeded: { bg: "rgba(52,211,153,0.15)", color: "#34d399" }, // emerald-400
  failed: { bg: "rgba(248,113,113,0.15)", color: "#f87171" }, // red-400
};

export function StatusTag({ status, loading }: { status: Status; loading?: boolean }) {
  const locale = useLocale();

  if (loading) {
    return (
      <span
        className="fp-skeleton"
        style={{ display: "inline-block", width: 70, height: 20, borderRadius: 4 }}
      />
    );
  }

  const style = STATUS_STYLE[status];
  const labelMap: Record<Status, string> = {
    running: locale.statusRunning,
    succeeded: locale.statusSucceeded,
    failed: locale.statusFailed,
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 6,
        background: style.bg,
        color: style.color,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.03em",
      }}
      title={`Status: ${status}`}
    >
      <span
        style={{ width: 5, height: 5, borderRadius: "50%", background: style.color }}
        aria-hidden={true}
      />
      {labelMap[status]}
    </span>
  );
}
