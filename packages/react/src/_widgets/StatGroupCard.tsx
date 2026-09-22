"use client";
import { Card, CardContent, CardHeader } from "../_layout/Card";
import { useFormatting } from "../_provider/FormattingContext";
import {
  formatDateValue,
  formatNumber,
  type NumericFormat,
  type ResolvedFormatting,
  type Tone,
} from "../lib/format";

export interface StatGroupCardProps {
  label?: string;
  stats: Array<{ label: string; value: unknown; format?: NumericFormat; tone?: Tone }>;
}

function statText(
  value: unknown,
  format: NumericFormat | undefined,
  formatting: ResolvedFormatting,
): string {
  if (typeof value === "number") return formatNumber(value, format, formatting);
  if (value instanceof Date) return formatDateValue(value, formatting);
  return String(value ?? "—");
}

export function StatGroupCard({ label, stats }: StatGroupCardProps) {
  const formatting = useFormatting();
  return (
    <Card>
      {label ? <CardHeader>{label}</CardHeader> : null}
      <CardContent className={label ? "pt-0" : ""}>
        <dl className="grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <div key={s.label} data-tone={s.tone}>
              <dt className="text-xs text-fp-text-3 uppercase tracking-wide">{s.label}</dt>
              <dd className="text-base text-fp-text-1 font-medium tabular-nums mt-0.5">
                {statText(s.value, s.format, formatting)}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
