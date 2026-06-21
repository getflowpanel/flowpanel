"use client";

/**
 * "● Live" connection indicator — green + pulsing when the live stream is
 * delivering, amber otherwise. `live` comes from `useLiveChannel`.
 */
export function LiveDot({ live }: { live: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fp-text-2">
      <span className="relative flex h-2 w-2">
        {live ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fp-ok opacity-60" />
        ) : null}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${live ? "bg-fp-ok" : "bg-fp-warn"}`}
        />
      </span>
      {live ? "Live" : "Connecting…"}
    </span>
  );
}
