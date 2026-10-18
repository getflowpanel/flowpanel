"use client";
import * as React from "react";
import { cn } from "../lib/cn";
import { isChunkLoadError, retryFailedParts } from "../lib/lazy-retry";
import { useLabels } from "../provider/LabelsContext";

export function ChunkFailed({ onRetry, floating }: { onRetry: () => void; floating?: boolean }) {
  const { errors } = useLabels();
  return (
    <div
      role="alert"
      className={cn(
        "fp-flex fp-items-center fp-gap-3 fp-text-sm fp-text-soft",
        floating &&
          "fp-fixed fp-bottom-4 fp-left-1/2 fp-z-50 -fp-translate-x-1/2 fp-rounded-lg fp-border fp-border-line fp-bg-surface fp-px-4 fp-py-2 fp-shadow-md",
      )}
    >
      <span>{errors.network}</span>
      <button
        type="button"
        onClick={onRetry}
        className="fp-rounded-sm fp-underline fp-underline-offset-4 hover:fp-text-ink focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60"
      >
        {errors.retry}
      </button>
    </div>
  );
}

/** Keeps a part whose code cannot be fetched from taking the page down; Retry loads it again. Other errors pass up. */
export class ChunkBoundary extends React.Component<
  { children: React.ReactNode; floating?: boolean },
  { error: unknown }
> {
  override state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown): { error: unknown } {
    return { error };
  }

  override render(): React.ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    if (!isChunkLoadError(error)) throw error;
    return (
      <ChunkFailed
        onRetry={() => {
          retryFailedParts();
          this.setState({ error: null });
        }}
        {...(this.props.floating ? { floating: true } : {})}
      />
    );
  }
}
