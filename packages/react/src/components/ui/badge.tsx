import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils/cn";

const badgeVariants = cva(
  "fp:inline-flex fp:items-center fp:rounded-full fp:px-2.5 fp:py-0.5 fp:text-xs fp:font-semibold fp:transition-colors",
  {
    variants: {
      variant: {
        default: "fp:border fp:border-border fp:bg-background fp:text-foreground",
        ok: "fp:bg-status-ok/10 fp:text-status-ok",
        err: "fp:bg-status-err/10 fp:text-status-err",
        warn: "fp:bg-status-warn/10 fp:text-status-warn",
        running: "fp:bg-status-running/10 fp:text-status-running",
        muted: "fp:bg-muted fp:text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
