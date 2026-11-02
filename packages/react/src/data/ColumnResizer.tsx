"use client";
import * as React from "react";
import { cn } from "../lib/cn";

export interface ColumnResizerProps {
  onResize: (deltaPx: number) => void;
  onResizeEnd: () => void;
  /** Sizes the column to its widest value on a double click. */
  onFit?: () => void;
  className?: string;
  title?: string;
}

/** The pointer's drag handle at a resizable <th>'s right edge; the header itself takes the keys. */
export function ColumnResizer({
  onResize,
  onResizeEnd,
  onFit,
  className,
  title,
}: ColumnResizerProps) {
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

  return (
    <span
      aria-hidden
      data-fp-resizer=""
      title={title}
      className={cn(
        "fp-absolute fp-right-0 fp-top-0 fp-h-full fp-w-1.5 fp-cursor-col-resize fp-touch-none fp-select-none fp-bg-transparent fp-transition-colors hover:fp-bg-accent/30",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onFit?.();
      }}
    />
  );
}
