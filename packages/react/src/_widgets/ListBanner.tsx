import { Card, CardContent } from "../_layout/Card";
import { cn } from "../lib/cn";
import { QUIET_LINK } from "../lib/label-text";
import { toneFillClass } from "../lib/tone-classes";
import { CardHeading } from "./CardHeading";
import type { ListCardProps } from "./ListCard";
import { ToneWord } from "./ToneWord";
import { fullTextTitle, TWO_LINES } from "./wrap-text";

type Row = ListCardProps["rows"][number];

const RULE = { err: "border-l-[3px] border-l-fp-err", warn: "border-l-[3px] border-l-fp-warn" };

function Trail({ row }: { row: Row }) {
  const after = [row.since, row.meta].filter(Boolean).join(" · ");
  if (!row.count && !after) return null;
  return (
    <span
      className={cn(TWO_LINES, "max-w-[45%] shrink-0 text-right text-xs text-fp-text-3")}
      {...fullTextTitle([row.count, after].filter(Boolean).join(" · "))}
    >
      {row.count ? (
        <span className="font-medium tabular-nums text-fp-text-1">{row.count}</span>
      ) : null}
      {row.count && after ? " · " : null}
      {after ? <span>{after}</span> : null}
    </span>
  );
}

function Text({ row, className }: { row: Row; className: string }) {
  return (
    <span className={cn(TWO_LINES, "min-w-0 flex-1", className)} {...fullTextTitle(row.text)}>
      {row.href ? (
        <a href={row.href} className="hover:underline">
          {row.text}
        </a>
      ) : (
        row.text
      )}
    </span>
  );
}

/** "Anything on fire": the worst row as a sentence, the rest as dot lines, or one all-clear line. */
export function ListBanner({ label, rows, allClear, more, caption }: ListCardProps) {
  const worst = rows.some((row) => row.tone === "err")
    ? "err"
    : rows.some((row) => row.tone === "warn")
      ? "warn"
      : undefined;
  const leadIndex = Math.max(0, worst ? rows.findIndex((row) => row.tone === worst) : 0);
  const lead = rows[leadIndex];
  const rest = rows.filter((_, index) => index !== leadIndex);
  return (
    <Card className={cn("h-full", worst ? RULE[worst] : "")} data-fp-banner={worst ?? "clear"}>
      <CardHeading label={label} caption={caption} />
      <CardContent className={label || caption ? "pt-0" : ""}>
        {lead === undefined ? (
          <p className="text-sm text-fp-text-2">{allClear}</p>
        ) : (
          <ul className="space-y-2">
            <li data-tone={lead.tone ?? "info"} className="flex items-baseline gap-3">
              <ToneWord tone={lead.tone ?? "info"} />
              <Text row={lead} className="text-lg font-medium leading-6 text-fp-text-1" />
              <Trail row={lead} />
            </li>
            {rest.map((row, index) => (
              <li
                key={row.key ?? `#${index + 1}`}
                data-tone={row.tone ?? "info"}
                className="flex items-baseline gap-2 text-sm"
              >
                <span
                  aria-hidden
                  data-tone-dot=""
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 self-start rounded-full",
                    toneFillClass[row.tone ?? "info"],
                  )}
                />
                <ToneWord tone={row.tone ?? "info"} />
                <Text row={row} className="text-fp-text-2" />
                <Trail row={row} />
              </li>
            ))}
          </ul>
        )}
        {more ? (
          <div className="mt-3 text-xs">
            {more.href ? (
              <a href={more.href} className={QUIET_LINK}>
                {more.label}
              </a>
            ) : (
              <span className="text-fp-text-3">{more.label}</span>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
