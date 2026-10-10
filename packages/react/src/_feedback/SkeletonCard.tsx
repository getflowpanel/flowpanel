import type * as React from "react";
import { Card } from "../_layout/Card";
import { Skeleton } from "../ui/skeleton";

export function SkeletonCard({ height = 80 }: { height?: number }) {
  const cssVars = { "--fp-skeleton-h": `${height}px` } as React.CSSProperties;
  return (
    <Card>
      <div style={cssVars} className="fp-p-4 fp-h-[var(--fp-skeleton-h)]">
        <Skeleton className="fp-h-4 fp-w-24 fp-mb-2" />
        <Skeleton className="fp-h-8 fp-w-32" />
      </div>
    </Card>
  );
}
