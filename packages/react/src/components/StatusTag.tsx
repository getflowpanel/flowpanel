import { useLocale } from "../locale/LocaleContext";

export type Status = "running" | "succeeded" | "failed";

// Status colors flow through `--fp-status-*` tokens (see styles/tokens.css),
// so a theme preset can recolor them without touching this component. Each
// status uses the same hue at full opacity for the foreground and at 0.15
// alpha for the background — the contrast pair was picked to meet WCAG AA
// 4.5:1 over both light and dark admin surfaces.
const STATUS_STYLE: Record<Status, { bg: string; color: string }> = {
  running: {
    bg: "hsl(var(--fp-status-running) / 0.15)",
    color: "hsl(var(--fp-status-running))",
  },
  succeeded: {
    bg: "hsl(var(--fp-status-success) / 0.15)",
    color: "hsl(var(--fp-status-success))",
  },
  failed: {
    bg: "hsl(var(--fp-status-error) / 0.15)",
    color: "hsl(var(--fp-status-error))",
  },
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
