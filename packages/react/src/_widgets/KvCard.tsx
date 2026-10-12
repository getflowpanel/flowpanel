import type { WidgetCaption } from "@flowpanel/core";
import type * as React from "react";
import { LocalTime } from "../_atoms/LocalTime";
import { Card, CardContent } from "../_layout/Card";
import { cn } from "../lib/cn";
import type { Tone } from "../lib/format";
import { LABEL_TEXT, QUIET_LINK } from "../lib/label-text";
import { toneTextClass } from "../lib/tone-classes";
import { CardHeading } from "./CardHeading";
import { type CardDate, isCardDate } from "./card-date";
import { fullTextTitle, TWO_LINES } from "./wrap-text";

export interface KvCardItem {
  label: string;
  /** Already formatted on the server, so the card renders it verbatim; a `CardDate` renders as `LocalTime`. */
  value: React.ReactNode | CardDate;
  tone?: Tone;
  /** Renders the value as a link. */
  href?: string;
  /** A paragraph across the card: line breaks kept, never clamped. */
  long?: boolean;
  /** A long value's text past its fold, shown under `more`. */
  rest?: string;
  /** The fold's summary — "Show all". */
  more?: string;
}

export interface KvCardProps {
  label?: string;
  items: KvCardItem[];
  columns?: 1 | 2;
  /** The line under the title: a cut range, freshness or coverage. */
  caption?: WidgetCaption;
}

function Value({ item }: { item: KvCardItem }) {
  const value = isCardDate(item.value) ? <LocalTime date={item.value.iso} /> : item.value;
  return item.href ? (
    <a href={item.href} className="hover:fp-underline">
      {value}
    </a>
  ) : (
    value
  );
}

function LongValue({ item }: { item: KvCardItem }) {
  return (
    <dd
      data-long=""
      className={cn(
        "fp-mt-0.5 fp-whitespace-pre-wrap fp-break-words fp-text-sm fp-leading-relaxed",
        toneTextClass[item.tone ?? "default"],
      )}
    >
      <Value item={item} />
      {item.rest ? (
        <details className="fp-mt-1">
          <summary className={cn("fp-cursor-pointer fp-text-xs", QUIET_LINK)}>{item.more}</summary>
          {item.rest}
        </details>
      ) : null}
    </dd>
  );
}

/** The facts about one thing, as a `kv()` widget. */
export function KvCard({ label, items, columns = 2, caption }: KvCardProps) {
  return (
    <Card className="fp-h-full">
      <CardHeading label={label} caption={caption} />
      <CardContent className={label || caption ? "fp-pt-0" : ""}>
        <dl className={cn("fp-grid fp-gap-3", columns === 1 ? "fp-grid-cols-1" : "fp-grid-cols-2")}>
          {items.map((item, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: items are ordered and labels may repeat
              key={index}
              data-tone={item.tone}
              className={item.long ? "fp-col-span-full" : undefined}
            >
              <dt className={cn("fp-truncate", LABEL_TEXT)}>{item.label}</dt>
              {item.long ? (
                <LongValue item={item} />
              ) : (
                <dd
                  className={cn(
                    TWO_LINES,
                    "fp-mt-0.5 fp-text-sm fp-font-medium fp-tabular-nums",
                    toneTextClass[item.tone ?? "default"],
                  )}
                  {...fullTextTitle(item.value)}
                >
                  <Value item={item} />
                </dd>
              )}
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
