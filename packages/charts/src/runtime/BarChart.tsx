"use client";
import type { BarChartOptions } from "@flowpanel/core";
import {
  Bar,
  CartesianGrid,
  BarChart as RcBar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildTickFormatter } from "./format-tick.js";

export function BarChart({ data, options }: { data: unknown[]; options: BarChartOptions }) {
  const ys = Array.isArray(options.y) ? options.y : [options.y];
  const layout = options.horizontal ? "vertical" : "horizontal";
  const categoryTickFormatter = buildTickFormatter(
    data as Record<string, unknown>[],
    options.x,
    options.bucket,
  );
  return (
    <ResponsiveContainer width="100%" height={options.height ?? 240}>
      <RcBar data={data as object[]} layout={layout}>
        <CartesianGrid stroke="hsl(var(--fp-border-1))" strokeDasharray="3 3" />
        {options.horizontal ? (
          <>
            <XAxis type="number" stroke="hsl(var(--fp-text-3))" fontSize={12} />
            <YAxis
              type="category"
              dataKey={options.x}
              stroke="hsl(var(--fp-text-3))"
              fontSize={12}
              tickFormatter={categoryTickFormatter}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey={options.x}
              stroke="hsl(var(--fp-text-3))"
              fontSize={12}
              tickFormatter={categoryTickFormatter}
            />
            <YAxis stroke="hsl(var(--fp-text-3))" fontSize={12} />
          </>
        )}
        <Tooltip
          contentStyle={{
            background: "hsl(var(--fp-bg-1))",
            border: "1px solid hsl(var(--fp-border-1))",
            borderRadius: "var(--fp-radius)",
            color: "hsl(var(--fp-text-1))",
          }}
        />
        {ys.map((y) => (
          <Bar
            key={y}
            dataKey={y}
            {...(options.stacked ? { stackId: "a" } : {})}
            fill="hsl(var(--fp-accent))"
          />
        ))}
      </RcBar>
    </ResponsiveContainer>
  );
}
