import { Card, CardContent, CardHeader } from "../_layout/Card.js";
import { formatNumber, type NumericFormat, type Tone } from "../lib/format.js";

export interface StatGroupCardProps {
  label?: string;
  stats: Array<{ label: string; value: unknown; format?: NumericFormat; tone?: Tone }>;
}

export function StatGroupCard({ label, stats }: StatGroupCardProps) {
  return (
    <Card>
      {label ? <CardHeader>{label}</CardHeader> : null}
      <CardContent className={label ? "pt-0" : ""}>
        <dl className="grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <div key={s.label} data-tone={s.tone}>
              <dt className="text-xs text-fp-text-3 uppercase tracking-wide">{s.label}</dt>
              <dd className="text-base text-fp-text-1 font-medium tabular-nums mt-0.5">
                {typeof s.value === "number"
                  ? formatNumber(s.value, s.format)
                  : String(s.value ?? "—")}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
