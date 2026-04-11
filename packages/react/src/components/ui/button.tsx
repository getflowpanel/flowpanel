import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils/cn";

const buttonVariants = cva(
  "fp:inline-flex fp:items-center fp:justify-center fp:whitespace-nowrap fp:rounded-md fp:text-sm fp:font-medium fp:ring-offset-background fp:transition-colors fp:focus-visible:outline-none fp:focus-visible:ring-2 fp:focus-visible:ring-primary fp:focus-visible:ring-offset-2 fp:disabled:pointer-events-none fp:disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "fp:bg-primary fp:text-primary-foreground fp:hover:bg-primary/90",
        destructive: "fp:bg-destructive fp:text-destructive-foreground fp:hover:bg-destructive/90",
        outline:
          "fp:border fp:border-border fp:bg-background fp:hover:bg-accent fp:hover:text-accent-foreground",
        ghost: "fp:hover:bg-accent fp:hover:text-accent-foreground",
      },
      size: {
        default: "fp:h-10 fp:px-4 fp:py-2",
        sm: "fp:h-9 fp:rounded-md fp:px-3",
        icon: "fp:h-10 fp:w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
