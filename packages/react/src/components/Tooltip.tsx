import React from "react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  delay?: number;
}

export function Tooltip({ content, children, delay = 400 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useRef(`fp-tooltip-${Math.random().toString(36).slice(2)}`);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const top = rect.top - 8;
      const left = rect.left + rect.width / 2;
      setPos({ top, left });
      setVisible(true);
    }, delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hide]);

  const child = children as React.ReactElement<Record<string, unknown>>;
  const cloned = React.cloneElement(child, {
    ref: triggerRef,
    "aria-describedby": visible ? tooltipId.current : undefined,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
  });

  return (
    <>
      {cloned}
      {visible &&
        createPortal(
          <div
            id={tooltipId.current}
            role="tooltip"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: "translate(-50%, -100%)",
              background: "var(--fp-surface-3)",
              color: "var(--fp-text-1)",
              border: "1px solid var(--fp-border-2)",
              borderRadius: "var(--fp-radius-md)",
              padding: "4px 8px",
              fontSize: 12,
              whiteSpace: "nowrap",
              zIndex: 300,
              pointerEvents: "none",
              animation: "fp-tooltip-in 100ms var(--fp-ease-out) forwards",
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
