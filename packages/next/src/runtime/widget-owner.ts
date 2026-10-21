import { AsyncLocalStorage } from "node:async_hooks";
import type { WidgetConfig } from "@flowpanel/core";
import { describeError } from "@flowpanel/core/internal";
import { plainAggregates } from "./caught-error";
import { isConnectionError } from "./connection-error";
import { isControlFlow } from "./query-error";

/** Which widget ran: its kind, its card title, the page and its place on the page. */
export interface WidgetOwner {
  kind: WidgetConfig["kind"];
  label: string | null;
  where: string;
  position: string;
}

interface Frame {
  owner: WidgetOwner;
  hits: number;
}

const frames = new AsyncLocalStorage<Frame>();

export const SLOW_WIDGET_MS = 300;

/** The title a widget's card shows, which errors and timings name it by. */
export function widgetLabel(widget: WidgetConfig): string | null {
  if ("label" in widget && typeof widget.label === "string") return widget.label;
  const label = (widget.options as { label?: unknown }).label;
  return typeof label === "string" ? label : null;
}

export function widgetOwner(widget: WidgetConfig, where: string, position: string): WidgetOwner {
  return { kind: widget.kind, label: widgetLabel(widget), where, position };
}

/** `«Label» (kind, where position)`, or `kind (where position)` for a widget without a title. */
export function describeOwner(owner: WidgetOwner): string {
  const place = `${owner.where} ${owner.position}`;
  return owner.label ? `«${owner.label}» (${owner.kind}, ${place})` : `${owner.kind} (${place})`;
}

/** A widget's error, prefixed with the widget that threw it. */
export class WidgetFailure extends Error {
  readonly where: string;
  readonly position: string;
  readonly kind: string;
  readonly label: string | null;

  /** Each cause by its first line; production drops the cause itself, whose driver error Next would log with its query parameters. */
  constructor(owner: WidgetOwner, cause: unknown) {
    const reason = describeError(cause).replace(/^Error: /, "");
    super(
      `${describeOwner(owner)}: ${reason}`,
      process.env.NODE_ENV === "production" ? undefined : { cause },
    );
    // The widget boundary reads this name, which the dev renderer carries to the browser, to show the connection hint.
    this.name = isConnectionError(cause) ? "WidgetConnectionFailure" : "WidgetFailure";
    this.where = owner.where;
    this.position = owner.position;
    this.kind = owner.kind;
    this.label = owner.label;
  }
}

/** Counts a memoised read that another widget already started against the widget running now. */
export function noteMemoHit(): void {
  const frame = frames.getStore();
  if (frame) frame.hits += 1;
}

export function currentWidgetOwner(): WidgetOwner | null {
  return frames.getStore()?.owner ?? null;
}

export interface PageTimer {
  run<T>(owner: WidgetOwner, render: () => Promise<T>): Promise<T>;
}

interface Settled {
  owner: WidgetOwner;
  ms: number;
  hits: number;
}

function slowLine(page: string, settled: readonly Settled[]): string | null {
  const slow = settled
    .filter((entry) => entry.ms >= SLOW_WIDGET_MS)
    .sort((a, b) => b.ms - a.ms)
    .map(({ owner, ms, hits }) => {
      const memo = hits === 0 ? "" : `, ${hits} memo ${hits === 1 ? "hit" : "hits"}`;
      return `${describeOwner(owner)} ${Math.round(ms)} ms${memo}`;
    });
  return slow.length === 0 ? null : `[flowpanel] slow widgets on ${page}: ${slow.join("; ")}`;
}

/**
 * Runs each widget of one page render under its owner, so a failure names it. In development,
 * once `expected` widgets have settled, logs one line of those that took 300 ms or more.
 */
export function pageTimer(
  page: string,
  expected: number,
  clock: { now?: () => number; log?: (line: string) => void } = {},
): PageTimer {
  const now = clock.now ?? (() => performance.now());
  const log = clock.log ?? ((line: string) => console.info(line));
  const settled: Settled[] = [];
  const settle = (entry: Settled): void => {
    settled.push(entry);
    if (process.env.NODE_ENV === "production" || settled.length !== expected) return;
    const line = slowLine(page, settled);
    if (line) log(line);
  };
  return {
    run(owner, render) {
      const frame: Frame = { owner, hits: 0 };
      const started = now();
      return frames.run(frame, async () => {
        try {
          return await render();
        } catch (cause) {
          if (cause instanceof WidgetFailure || isControlFlow(cause)) throw cause;
          plainAggregates(cause);
          throw new WidgetFailure(owner, cause);
        } finally {
          settle({ owner, ms: now() - started, hits: frame.hits });
        }
      });
    },
  };
}
