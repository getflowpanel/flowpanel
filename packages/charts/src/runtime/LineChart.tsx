"use client";
import type { LineChartOptions } from "@flowpanel/core";
import {
  CartesianGrid,
  Line,
  LineChart as RcLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function LineChart({ data, options }: { data: unknown[]; options: LineChartOptions }) {
  const ys = Array.isArray(options.y) ? options.y : [options.y];
  return (
    <ResponsiveContainer width="100%" height={options.height ?? 240}>
      <RcLine data={data as object[]}>
        <CartesianGrid stroke="hsl(var(--fp-border-1))" strokeDasharray="3 3" />
        <XAxis dataKey={options.x} stroke="hsl(var(--fp-text-3))" fontSize={12} />
        <YAxis stroke="hsl(var(--fp-text-3))" fontSize={12} />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--fp-bg-1))",
            border: "1px solid hsl(var(--fp-border-1))",
            borderRadius: "var(--fp-radius)",
            color: "hsl(var(--fp-text-1))",
          }}
        />
        {ys.map((y) => (
          <Line
            key={y}
            type={options.smooth ? "monotone" : "linear"}
            dataKey={y}
            stroke="hsl(var(--fp-accent))"
            strokeWidth={2}
            dot={options.markers ?? false}
          />
        ))}
      </RcLine>
    </ResponsiveContainer>
  );
}
