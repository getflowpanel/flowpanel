import { Card, CardContent } from "../layout/Card";
import { cn } from "../lib/cn";
import { INLINE_LINK, QUIET_LINK } from "../lib/label-text";
import { toneFillClass } from "../lib/tone-classes";
import { CardHeading } from "./CardHeading";
import type { ListCardProps } from "./ListCard";
import { ToneWord } from "./ToneWord";
import { fullTextTitle, TWO_LINES } from "./wrap-text";

type Row = ListCardProps["rows"][number];

const RULE = {
  err: "fp-border-l-[3px] fp-border-l-err",
  warn: "fp-border-l-[3px] fp-border-l-warn",
};

function Trail({ row }: { row: Row }) {
  const after = [row.since, row.meta].filter(Boolean).join(" · ");
  if (!row.count && !after) return null;
  return (
    <span
      className={cn(TWO_LINES, "fp-max-w-[45%] fp-shrink-0 fp-text-right fp-text-xs fp-text-faint")}
      {...fullTextTitle([row.count, after].filter(Boolean).join(" · "))}
    >
      {row.count ? (
        <span className="fp-font-medium fp-tabular-nums fp-text-ink">{row.count}</span>
      ) : null}
      {row.count && after ? " · " : null}
      {after ? <span>{after}</span> : null}
    </span>
  );
}

function Text({ row, className }: { row: Row; className: string }) {
  return (
    <span className={cn(TWO_LINES, "fp-min-w-0 fp-flex-1", className)} {...fullTextTitle(row.text)}>
      {row.href ? (
        <a href={row.href} className={INLINE_LINK}>
          {row.text}
        </a>
      ) : (
        row.text
      )}
    </span>
  );
}

/** Same props as `ListCard`. */
export type ListBannerProps = ListCardProps;

/** "Anything on fire": the worst row as a sentence, the rest as dot lines, or one all-clear line. */
export function ListBanner({ label, rows, allClear, more, caption }: ListBannerProps) {
  const worst = rows.some((row) => row.tone === "err")
    ? "err"
    : rows.some((row) => row.tone === "warn")
      ? "warn"
      : undefined;
  const leadIndex = Math.max(0, worst ? rows.findIndex((row) => row.tone === worst) : 0);
  const lead = rows[leadIndex];
  const rest = rows.filter((_, index) => index !== leadIndex);
  return (
    <Card className={cn("fp-h-full", worst ? RULE[worst] : "")} data-fp-banner={worst ?? "clear"}>
      <CardHeading label={label} caption={caption} />
      <CardContent className={label || caption ? "fp-pt-0" : ""}>
        {lead === undefined ? (
          <p className="fp-text-sm fp-text-soft">{allClear}</p>
        ) : (
          <ul className="fp-space-y-2">
            <li data-tone={lead.tone ?? "info"} className="fp-flex fp-items-baseline fp-gap-3">
              <ToneWord tone={lead.tone ?? "info"} />
              <Text row={lead} className="fp-text-lg fp-font-medium fp-leading-6 fp-text-ink" />
              <Trail row={lead} />
            </li>
            {rest.map((row, index) => (
              <li
                key={row.key ?? `#${index + 1}`}
                data-tone={row.tone ?? "info"}
                className="fp-flex fp-items-baseline fp-gap-2 fp-text-sm"
              >
                <span
                  aria-hidden
                  data-tone-dot=""
                  className={cn(
                    "fp-mt-1.5 fp-h-2 fp-w-2 fp-shrink-0 fp-self-start fp-rounded-full",
                    toneFillClass[row.tone ?? "info"],
                  )}
                />
                <ToneWord tone={row.tone ?? "info"} />
                <Text row={row} className="fp-text-soft" />
                <Trail row={row} />
              </li>
            ))}
          </ul>
        )}
        {more ? (
          <div className="fp-mt-3 fp-text-xs">
            {more.href ? (
              <a href={more.href} className={QUIET_LINK}>
                {more.label}
              </a>
            ) : (
              <span className="fp-text-faint">{more.label}</span>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
