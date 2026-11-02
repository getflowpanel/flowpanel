"use client";
import type { WidgetCaption, WidgetConfig } from "@flowpanel/core";
import { chartBox } from "@flowpanel/core/internal";
import { Card, CardHeading } from "@flowpanel/react";
import { type ReactNode, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChartSkeleton } from "./ChartSkeleton";
import { ChartBody } from "./lazy-body";

type ChartWidget = Extract<WidgetConfig, { kind: `${string}Chart` }>;

export interface ChartRendererProps {
  kind: ChartWidget["kind"];
  label?: string;
  options: ChartWidget["options"];
  data: unknown[];
  /** Legend and tooltip name per series key, resolved on the server. */
  seriesLabels?: Readonly<Record<string, string>>;
  /** The card's link, resolved on the server from the widget's `drilldown`. */
  drilldown?: string;
  /** The line under the title, computed on the server. */
  caption?: WidgetCaption;
}

const FILL = { height: "100%" };

/** Draws the chart at the height its box takes from its width; a hidden box, measured 0, is skipped. */
function ChartFrame(props: ChartRendererProps) {
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => {
      if (element.offsetHeight > 0) setHeight(element.offsetHeight);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={box} style={chartBox(props.options.height)}>
      {height === null ? (
        <ChartSkeleton style={FILL} />
      ) : (
        <Suspense fallback={<ChartSkeleton style={FILL} />}>
          <ChartBody {...props} options={{ ...props.options, height }} />
        </Suspense>
      )}
    </div>
  );
}

/** Recharts measures its container, which the server lacks, so a skeleton in the chart's box holds until it mounts and loads. */
export function chartBody(props: ChartRendererProps, mounted: boolean): ReactNode {
  if (!mounted) return <ChartSkeleton style={chartBox(props.options.height)} />;
  if (props.data.length === 0) {
    return (
      <Suspense fallback={null}>
        <ChartBody {...props} />
      </Suspense>
    );
  }
  if (props.options.height !== undefined) {
    return (
      <Suspense fallback={<ChartSkeleton style={chartBox(props.options.height)} />}>
        <ChartBody {...props} />
      </Suspense>
    );
  }
  return <ChartFrame {...props} />;
}

/** Wrap a chart card in its link when it has one. */
export function chartFrame(
  card: ReactNode,
  { label, drilldown }: Pick<ChartRendererProps, "label" | "drilldown">,
): ReactNode {
  if (!drilldown) return card;
  return (
    <a
      href={drilldown}
      className="fp-block fp-h-full fp-rounded-lg fp-transition-opacity hover:fp-opacity-90 focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60"
      {...(label ? { "aria-label": label } : {})}
    >
      {card}
    </a>
  );
}

export function ChartRenderer(props: ChartRendererProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return chartFrame(
    <Card className="fp-h-full">
      <CardHeading label={props.label} caption={props.caption} />
      <div className="fp-p-3">{chartBody(props, mounted)}</div>
    </Card>,
    props,
  );
}
