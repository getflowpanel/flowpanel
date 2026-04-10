import { useEffect, useRef } from "react";

export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  handler: (e: KeyboardEvent) => void;
  description?: string;
}

export function useKeyboard(bindings: KeyBinding[], enabled = true): void {
  // Keep bindings in a ref to avoid re-registering listeners on every render
  const bindingsRef = useRef(bindings);
  useEffect(() => {
    bindingsRef.current = bindings;
  });

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isEditing =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      for (const binding of bindingsRef.current) {
        const keyMatch = e.key === binding.key;
        const metaMatch = binding.meta ? e.metaKey || e.ctrlKey : true;
        const ctrlMatch = binding.ctrl ? e.ctrlKey : true;
        const shiftMatch = binding.shift ? e.shiftKey : !e.shiftKey;

        if (!keyMatch || !metaMatch || !ctrlMatch || !shiftMatch) continue;

        // Skip when typing in inputs, except for Escape (always works)
        if (isEditing && binding.key !== "Escape") continue;

        e.preventDefault();
        binding.handler(e);
        break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
