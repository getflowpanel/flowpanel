import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "../../utils/cn";
import { useFlowPanelContainer } from "../../context";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>) {
  const container = useFlowPanelContainer();

  return (
    <TooltipPrimitive.Portal container={container}>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "fp:z-50 fp:overflow-hidden fp:rounded-md fp:border fp:border-border fp:bg-card fp:px-3 fp:py-1.5 fp:text-sm fp:text-card-foreground fp:shadow-md fp:animate-in fp:fade-in-0 fp:zoom-in-95",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}
