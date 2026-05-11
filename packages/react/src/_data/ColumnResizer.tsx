"use client";
import * as React from "react";

export interface ColumnResizerProps {
  onResize: (deltaPx: number) => void;
  onResizeEnd: () => void;
  className?: string;
}

/**
 * Internal drag handle rendered at the right edge of a resizable <th>.
 * Uses Pointer Events with pointer capture for smooth resize.
 */
export function ColumnResizer({ onResize, onResizeEnd, className }: ColumnResizerProps) {
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
    } catch {
      // Pointer may already be released
    }
    onResizeEnd();
  };

  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize column"
      className={`absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none bg-transparent transition-colors hover:bg-fp-accent/30 ${className ?? ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
