import { forwardRef } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../../utils/cn";

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("fp:flex fp:flex-row fp:items-center fp:border-b fp:border-border", className)}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "fp:inline-flex fp:items-center fp:justify-center fp:px-4 fp:py-2 fp:text-sm fp:font-medium fp:text-muted-foreground fp:transition-colors fp:hover:text-foreground fp:focus-visible:outline-none fp:disabled:pointer-events-none fp:disabled:opacity-50 fp:border-b-2 fp:border-transparent fp:-mb-px fp:data-[state=active]:border-primary fp:data-[state=active]:text-foreground",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("fp:mt-2 fp:focus-visible:outline-none", className)}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";
