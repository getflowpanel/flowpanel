"use client";

/**
 * Custom page: per-user AI cost breakdown with provider comparison.
 *
 * Uses `useResource("aiCost")` + `useMetric()` to compose a report-style
 * view on top of the same tRPC endpoints that power the dashboard.
 */
export function AiCostsDetailPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">AI spend report</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <div className="text-xs text-muted-foreground">Total (30d)</div>
          <div className="mt-1 text-2xl font-semibold">$—</div>
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="text-xs text-muted-foreground">By provider</div>
          <div className="mt-1 text-sm">Chart goes here.</div>
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="text-xs text-muted-foreground">Top spenders</div>
          <div className="mt-1 text-sm">Table goes here.</div>
        </div>
      </div>
    </div>
  );
}
