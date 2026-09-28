import { Card, CardContent } from "../_layout/Card";
import { cn } from "../lib/cn";
import type { Tone } from "../lib/format";
import { toneTextClass } from "../lib/tone-classes";
import { CardHeading } from "./CardHeading";
import type { ListCardProps } from "./ListCard";

const GLYPH: Partial<Record<Tone, string>> = { err: "✕", warn: "▲" };
const TINT: Partial<Record<Tone, string>> = {
  err: "border-fp-err/40 bg-fp-err/5",
  warn: "border-fp-warn/40 bg-fp-warn/5",
};

function glyphTone(tone: Tone | undefined): Tone {
  return tone === "err" || tone === "warn" ? tone : "info";
}

/** "Anything on fire": rows by severity with a glyph each, or one all-clear line. */
export function ListBanner({ label, rows, allClear, more, caption }: ListCardProps) {
  const worst = rows.some((row) => row.tone === "err")
    ? "err"
    : rows.some((row) => row.tone === "warn")
      ? "warn"
      : undefined;
  return (
    <Card className={cn("h-full", worst ? TINT[worst] : "")} data-fp-banner={worst ?? "clear"}>
      <CardHeading label={label} caption={caption} />
      <CardContent className={label || caption ? "pt-0" : ""}>
        {rows.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-fp-ok-text">
            <span aria-hidden>✓</span>
            {allClear}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((row, index) => (
              <li
                key={row.key ?? `#${index}`}
                data-tone={row.tone ?? "info"}
                className="flex items-baseline gap-2 text-sm"
              >
                <span
                  aria-hidden
                  data-fp-glyph=""
                  className={cn("w-4 shrink-0 text-center", toneTextClass[glyphTone(row.tone)])}
                >
                  {GLYPH[glyphTone(row.tone)] ?? "●"}
                </span>
                <span className="min-w-0 flex-1 text-fp-text-1">
                  {row.href ? (
                    <a href={row.href} className="hover:underline">
                      {row.text}
                    </a>
                  ) : (
                    row.text
                  )}
                </span>
                {row.count ? (
                  <span className="shrink-0 font-medium tabular-nums text-fp-text-1">
                    {row.count}
                  </span>
                ) : null}
                {row.since || row.meta ? (
                  <span className="shrink-0 text-xs text-fp-text-3">
                    {[row.since, row.meta].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {more ? (
          <div className="mt-2 text-xs">
            {more.href ? (
              <a href={more.href} className="text-fp-accent hover:underline">
                {more.text}
              </a>
            ) : (
              <span className="text-fp-text-3">{more.text}</span>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
