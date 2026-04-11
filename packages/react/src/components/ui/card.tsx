import { forwardRef } from "react";
import { cn } from "../../utils/cn";

export const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "fp:rounded-lg fp:border fp:border-border fp:bg-card fp:text-card-foreground fp:shadow-sm fp:transition-shadow fp:hover:shadow-md",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("fp:flex fp:flex-col fp:space-y-1.5 fp:p-6", className)}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("fp:p-6 fp:pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";
