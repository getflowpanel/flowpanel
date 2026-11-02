"use client";
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import { useToast } from "../feedback/toast-api";
import { useLabels } from "../provider/LabelsContext";

export interface Deferred<M> {
  /** Loads the module once; answers whether it is there. A failed load may be asked for again. */
  ensure: () => Promise<boolean>;
  useLoaded: () => M | null;
  useFailed: () => boolean;
}

const TRIGGER = "[data-fp-trigger]";

/** Puts focus back on the trigger at `index` when swapping stand-ins for the real triggers dropped it. */
function keepFocus(index: number): void {
  if (index < 0) return;
  setTimeout(() => {
    if (document.activeElement && document.activeElement !== document.body) return;
    const trigger = document.querySelectorAll<HTMLElement>(TRIGGER)[index];
    trigger?.focus({ preventScroll: true });
  }, 0);
}

/** A module the page fetches the first time it is needed; until then its users render a light stand-in. */
export function deferredModule<M>(load: () => Promise<M>): Deferred<M> {
  let loaded: M | null = null;
  let failed = false;
  let pending: Promise<boolean> | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const ensure = (): Promise<boolean> => {
    pending ??= load().then(
      (module) => {
        const focused = Array.from(document.querySelectorAll(TRIGGER)).indexOf(
          document.activeElement ?? document.body,
        );
        loaded = module;
        failed = false;
        notify();
        keepFocus(focused);
        return true;
      },
      () => {
        pending = null;
        failed = true;
        notify();
        return false;
      },
    );
    return pending;
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  return {
    ensure,
    useLoaded: () =>
      React.useSyncExternalStore(
        subscribe,
        () => loaded,
        () => null,
      ),
    useFailed: () =>
      React.useSyncExternalStore(
        subscribe,
        () => failed,
        () => false,
      ),
  };
}

const RequestOpen = React.createContext<{ open: () => void; prefetch: () => void } | null>(null);

interface RootProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

/** The root before its module arrives: a press on its trigger fetches it and opens it once it is there. */
export function useDeferredRoot<M>(
  deferred: Deferred<M>,
  { open, defaultOpen, onOpenChange }: RootProps,
): {
  loaded: M | null;
  defaultOpen: boolean;
  provide: (children: React.ReactNode) => React.ReactNode;
} {
  const loaded = deferred.useLoaded();
  const toast = useToast();
  const { errors } = useLabels();
  const [asked, setAsked] = React.useState(false);
  const opening = open === true || defaultOpen === true;
  React.useEffect(() => {
    if (opening) void deferred.ensure();
  }, [opening, deferred]);
  const request = React.useMemo(
    () => ({
      open: () => {
        setAsked(true);
        onOpenChange?.(true);
        void deferred.ensure().then((ok) => {
          if (ok) return;
          setAsked(false);
          onOpenChange?.(false);
          toast.error(errors.network);
        });
      },
      prefetch: () => void deferred.ensure(),
    }),
    [onOpenChange, deferred, toast, errors.network],
  );
  return {
    loaded,
    defaultOpen: defaultOpen === true || (open === undefined && asked),
    provide: (children) => <RequestOpen.Provider value={request}>{children}</RequestOpen.Provider>,
  };
}

export interface DeferredTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  /** What the trigger opens, for `aria-haspopup`. */
  popup: "menu" | "dialog" | "listbox";
  /** Opens on press, as a menu and a select do, or on click, as a popover does. */
  opensOn: "press" | "click";
  /** Keys that open it; a button's own Enter and Space already click it. */
  keys?: readonly string[];
}

/** A trigger that looks and reads as the real one and asks its root to open. */
export const DeferredTrigger = React.forwardRef<HTMLButtonElement, DeferredTriggerProps>(
  function DeferredTrigger(
    {
      asChild,
      popup,
      opensOn,
      keys = [],
      onPointerEnter,
      onPointerDown,
      onKeyDown,
      onClick,
      children,
      ...rest
    },
    ref,
  ) {
    const request = React.useContext(RequestOpen);
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type="button"
        aria-haspopup={popup}
        aria-expanded={false}
        data-state="closed"
        data-fp-trigger=""
        {...rest}
        onPointerEnter={(event: React.PointerEvent<HTMLButtonElement>) => {
          onPointerEnter?.(event);
          if (event.pointerType === "mouse") request?.prefetch();
        }}
        onPointerDown={(event: React.PointerEvent<HTMLButtonElement>) => {
          onPointerDown?.(event);
          if (opensOn !== "press" || event.defaultPrevented) return;
          if (event.button !== 0 || event.ctrlKey) return;
          event.preventDefault();
          request?.open();
        }}
        onKeyDown={(event: React.KeyboardEvent<HTMLButtonElement>) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || !keys.includes(event.key)) return;
          event.preventDefault();
          request?.open();
        }}
        onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
          onClick?.(event);
          if (opensOn === "click" && !event.defaultPrevented) request?.open();
        }}
      >
        {children}
      </Comp>
    );
  },
);
