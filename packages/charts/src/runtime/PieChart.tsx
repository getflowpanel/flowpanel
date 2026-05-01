"use client";
import type { PieChartOptions } from "@flowpanel/core";
import { Cell, Legend, Pie, PieChart as RcPie, ResponsiveContainer, Tooltip } from "recharts";

const SLICE_COLORS = [
  "hsl(var(--fp-accent))",
  "hsl(var(--fp-accent) / 0.75)",
  "hsl(var(--fp-accent) / 0.55)",
  "hsl(var(--fp-accent) / 0.4)",
  "hsl(var(--fp-accent) / 0.25)",
];

export function PieChart({ data, options }: { data: unknown[]; options: PieChartOptions }) {
  return (
    <ResponsiveContainer width="100%" height={options.height ?? 240}>
      <RcPie>
        <Tooltip
          contentStyle={{
            background: "hsl(var(--fp-bg-1))",
            border: "1px solid hsl(var(--fp-border-1))",
            borderRadius: "var(--fp-radius)",
            color: "hsl(var(--fp-text-1))",
          }}
        />
        {options.showLegend ? <Legend /> : null}
        <Pie
          data={data as object[]}
          dataKey={options.value}
          nameKey={options.category}
          {...(options.donut ? { innerRadius: 60 } : {})}
          outerRadius={90}
          stroke="hsl(var(--fp-bg-1))"
        >
          {(data as object[]).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: chart slices are identified only by index.
            <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
          ))}
        </Pie>
      </RcPie>
    </ResponsiveContainer>
  );
}
