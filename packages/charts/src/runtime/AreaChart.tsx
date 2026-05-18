"use client";
import type { AreaChartOptions } from "@flowpanel/core";
import {
  Area,
  CartesianGrid,
  AreaChart as RcArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function AreaChart({ data, options }: { data: unknown[]; options: AreaChartOptions }) {
  const ys = Array.isArray(options.y) ? options.y : [options.y];
  return (
    <ResponsiveContainer width="100%" height={options.height ?? 240}>
      <RcArea data={data as object[]}>
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
          <Area
            key={y}
            type={options.smooth ? "monotone" : "linear"}
            dataKey={y}
            {...(options.stacked ? { stackId: "a" } : {})}
            stroke="hsl(var(--fp-accent))"
            fill="hsl(var(--fp-accent) / 0.2)"
            strokeWidth={2}
            isAnimationActive={false}
          />
        ))}
      </RcArea>
    </ResponsiveContainer>
  );
}
