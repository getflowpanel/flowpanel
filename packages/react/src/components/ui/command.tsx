import { forwardRef } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { cn } from "../../utils/cn";

export const Command = forwardRef<
  React.ComponentRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "fp:flex fp:h-full fp:w-full fp:flex-col fp:overflow-hidden fp:rounded-md fp:bg-background fp:text-foreground",
      className,
    )}
    {...props}
  />
));
Command.displayName = "Command";

export const CommandInput = forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="fp:flex fp:items-center fp:border-b fp:border-border fp:px-3">
    <Search className="fp:mr-2 fp:h-4 fp:w-4 fp:shrink-0 fp:opacity-50" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "fp:flex fp:h-10 fp:w-full fp:rounded-md fp:bg-transparent fp:py-3 fp:text-sm fp:outline-none fp:placeholder:text-muted-foreground fp:disabled:cursor-not-allowed fp:disabled:opacity-50",
        className,
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = "CommandInput";

export const CommandList = forwardRef<
  React.ComponentRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("fp:max-h-[300px] fp:overflow-y-auto fp:overflow-x-hidden", className)}
    {...props}
  />
));
CommandList.displayName = "CommandList";

export const CommandEmpty = forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty ref={ref} className="fp:py-6 fp:text-center fp:text-sm" {...props} />
));
CommandEmpty.displayName = "CommandEmpty";

export const CommandGroup = forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "fp:overflow-hidden fp:p-1 fp:text-foreground fp:[&_[cmdk-group-heading]]:px-2 fp:[&_[cmdk-group-heading]]:py-1.5 fp:[&_[cmdk-group-heading]]:text-xs fp:[&_[cmdk-group-heading]]:font-medium fp:[&_[cmdk-group-heading]]:text-muted-foreground",
      className,
    )}
    {...props}
  />
));
CommandGroup.displayName = "CommandGroup";

export const CommandItem = forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "fp:relative fp:flex fp:cursor-default fp:select-none fp:items-center fp:gap-2 fp:rounded-sm fp:px-2 fp:py-1.5 fp:text-sm fp:outline-none fp:data-[selected=true]:bg-accent fp:data-[selected=true]:text-accent-foreground fp:data-[disabled=true]:pointer-events-none fp:data-[disabled=true]:opacity-50",
      className,
    )}
    {...props}
  />
));
CommandItem.displayName = "CommandItem";
