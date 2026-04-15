import { Badge } from "../../ui/badge";
import { cn } from "../../utils/cn";

const COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  canceled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export function BadgeCell({ value }: { value: unknown }) {
  const str = String(value).toLowerCase();
  return (
    <Badge variant="secondary" className={cn("font-medium", COLORS[str])}>
      {String(value)}
    </Badge>
  );
}
