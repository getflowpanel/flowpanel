"use client";
import * as React from "react";
import { cn } from "../lib/cn";
import { useLabels } from "../provider/LabelsContext";

export interface ColumnResizerProps {
  onResize: (deltaPx: number) => void;
  onResizeEnd: () => void;
  className?: string;
}

/** Internal drag handle rendered at the right edge of a resizable <th>. */
export function ColumnResizer({ onResize, onResizeEnd, className }: ColumnResizerProps) {
  const { table } = useLabels();
  const startX = React.useRef<number | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    startX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (startX.current === null) return;
    const delta = e.clientX - startX.current;
    onResize(delta);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (startX.current === null) return;
    startX.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    onResizeEnd();
  };

  const KEY_STEP_PX = 8;
  const onKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    e.stopPropagation();
    onResize(e.key === "ArrowLeft" ? -KEY_STEP_PX : KEY_STEP_PX);
    onResizeEnd();
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: focusable draggable resize handle inside a <th>; <hr> cannot carry pointer-drag behavior and the role="separator" lookup is relied on by callers and tests.
    <span
      // biome-ignore lint/a11y/useAriaPropsForRole: a discrete resize nudge handle, not a min/max-bounded splitter — no numeric aria-valuenow is tracked, so aria-orientation alone describes it.
      role="separator"
      aria-orientation="vertical"
      aria-label={table.resizeColumn}
      tabIndex={0}
      className={cn(
        "fp-absolute fp-right-0 fp-top-0 fp-h-full fp-w-1 fp-cursor-col-resize fp-touch-none fp-select-none fp-bg-transparent fp-transition-colors hover:fp-bg-accent/30",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
