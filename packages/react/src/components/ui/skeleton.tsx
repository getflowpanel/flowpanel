import { cn } from "../../utils/cn";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("fp:animate-pulse fp:rounded-md fp:bg-muted", className)} {...props} />;
}
