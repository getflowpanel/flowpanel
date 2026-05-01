import { Card } from "../_layout/Card.js";
import { Skeleton } from "../ui/skeleton.js";

export function SkeletonCard({ height = 80 }: { height?: number }) {
  return (
    <Card>
      <div style={{ height }} className="p-4">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-8 w-32" />
      </div>
    </Card>
  );
}
