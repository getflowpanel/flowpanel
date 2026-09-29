import type { WidgetCaption } from "@flowpanel/core";
import type * as React from "react";
import { Card, CardContent } from "../_layout/Card";
import { cn } from "../lib/cn";
import type { Tone } from "../lib/format";
import { LABEL_TEXT, QUIET_LINK } from "../lib/label-text";
import { toneTextClass } from "../lib/tone-classes";
import { CardHeading } from "./CardHeading";
import { fullTextTitle, TWO_LINES } from "./wrap-text";

export interface KvCardItem {
  label: string;
  /** Already formatted on the server, so the card renders it verbatim. */
  value: React.ReactNode;
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
  return item.href ? (
    <a href={item.href} className="hover:underline">
      {item.value}
    </a>
  ) : (
    item.value
  );
}

function LongValue({ item }: { item: KvCardItem }) {
  return (
    <dd
      data-long=""
      className={cn(
        "mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed",
        toneTextClass[item.tone ?? "default"],
      )}
    >
      <Value item={item} />
      {item.rest ? (
        <details className="mt-1">
          <summary className={cn("cursor-pointer text-xs", QUIET_LINK)}>{item.more}</summary>
          {item.rest}
        </details>
      ) : null}
    </dd>
  );
}

/** The facts about one thing, as a `kv()` widget. */
export function KvCard({ label, items, columns = 2, caption }: KvCardProps) {
  return (
    <Card className="h-full">
      <CardHeading label={label} caption={caption} />
      <CardContent className={label || caption ? "pt-0" : ""}>
        <dl className={cn("grid gap-3", columns === 1 ? "grid-cols-1" : "grid-cols-2")}>
          {items.map((item, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: items are ordered and labels may repeat
              key={index}
              data-tone={item.tone}
              className={item.long ? "col-span-full" : undefined}
            >
              <dt className={cn("truncate", LABEL_TEXT)}>{item.label}</dt>
              {item.long ? (
                <LongValue item={item} />
              ) : (
                <dd
                  className={cn(
                    TWO_LINES,
                    "mt-0.5 text-sm font-medium tabular-nums",
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
