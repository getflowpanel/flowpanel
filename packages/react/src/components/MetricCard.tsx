import { cn } from "../utils/cn.js";
import { Skeleton } from "./ui/skeleton.js";

interface MetricCardProps {
  label: string;
  value: string | number | null;
  trend?: string;
  sublabel?: string;
  loading?: boolean;
  error?: string;
  onClick?: () => void;
  hasDrawer?: boolean;
  expanded?: boolean;
  sparkline?: number[];
  sparklineColor?: string;
  onRetry?: () => void;
}

function Sparkline({ data, color }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const barColor = color ?? "var(--fp-accent)";

  return (
    <div className="fp:flex fp:items-end fp:gap-[3px] fp:h-[22px] fp:mt-2" aria-hidden>
      {data.slice(0, 7).map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${Math.max((v / max) * 100, 4)}%`,
            background: barColor,
            borderRadius: 2,
            minWidth: 4,
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  );
}

const labelClasses =
  "fp:text-[11px] fp:font-semibold fp:tracking-[0.06em] fp:uppercase fp:text-muted-foreground fp:mb-2";

function CardContent({
  label,
  value,
  sparkline,
  sparklineColor,
  trend,
  sublabel,
}: Pick<
  MetricCardProps,
  "label" | "value" | "trend" | "sublabel" | "sparkline" | "sparklineColor"
>) {
  return (
    <>
      <div className={labelClasses}>{label}</div>
      <div className="fp-mono fp:text-[28px] fp:font-bold fp:text-foreground fp:leading-none">
        {value ?? "—"}
      </div>
      {sparkline && sparkline.length > 0 && <Sparkline data={sparkline} color={sparklineColor} />}
      {(trend || sublabel) && (
        <div className="fp:mt-1.5 fp:text-xs fp:text-muted-foreground">
          {trend && (
            <span style={{ color: trend.startsWith("+") ? "var(--fp-ok)" : "var(--fp-err)" }}>
              {trend}
            </span>
          )}
          {sublabel && <span className={cn(trend ? "fp:ml-1.5" : "")}>{sublabel}</span>}
        </div>
      )}
    </>
  );
}

export function MetricCard({
  label,
  value,
  trend,
  sublabel,
  loading,
  error,
  onClick,
  hasDrawer,
  expanded,
  sparkline,
  sparklineColor,
  onRetry,
}: MetricCardProps) {
  if (loading) {
    return (
      <div
        className="fp-card fp:py-5 fp:px-6 fp:min-w-[160px]"
        aria-busy="true"
        aria-label="Loading metric"
      >
        <Skeleton className="fp:h-[11px] fp:w-[60%] fp:mb-3" />
        <Skeleton className="fp:h-[28px] fp:w-[80%] fp:mb-2" />
        <Skeleton className="fp:h-[10px] fp:w-[40%]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fp-card fp:py-5 fp:px-6 fp:min-w-[160px]">
        <div className={labelClasses}>{label}</div>
        <div className="fp:text-xs fp:text-destructive fp:mb-2">{error}</div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="fp:py-1 fp:px-2.5 fp:text-[11px] fp:rounded fp:bg-muted fp:border fp:border-border fp:text-muted-foreground fp:cursor-pointer"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  const isClickable = !!onClick && !!hasDrawer;

  const cardClasses = cn(
    "fp-card",
    "fp:py-5 fp:px-6 fp:min-w-[160px] fp:text-left fp:border fp:border-border",
    "fp:transition-transform fp:duration-[var(--duration-fast)]",
    "hover:fp:-translate-y-px hover:fp:shadow-md",
    isClickable && "fp:cursor-pointer",
  );

  if (isClickable) {
    return (
      <button
        className={cardClasses}
        onClick={onClick}
        aria-expanded={expanded ?? false}
        aria-haspopup="dialog"
      >
        <CardContent
          label={label}
          value={value}
          sparkline={sparkline}
          sparklineColor={sparklineColor}
          trend={trend}
          sublabel={sublabel}
        />
      </button>
    );
  }

  return (
    <div className={cardClasses}>
      <CardContent
        label={label}
        value={value}
        sparkline={sparkline}
        sparklineColor={sparklineColor}
        trend={trend}
        sublabel={sublabel}
      />
    </div>
  );
}
