import { cn } from "../lib/cn";

export interface AvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE = { sm: 24, md: 32, lg: 48 } as const;
const SIZE_CLASS = { sm: "fp-w-6 fp-h-6", md: "fp-w-8 fp-h-8", lg: "fp-w-12 fp-h-12" } as const;

/** Pure renderer — no context dependency. Used as the registry default. */
export function DefaultAvatar({ src, alt, fallback, size = "md", className }: AvatarProps) {
  const px = SIZE[size];
  const sizeClass = SIZE_CLASS[size];
  const initials = (fallback ?? "").trim().slice(0, 2).toUpperCase() || "?";
  if (src) {
    return (
      // biome-ignore lint/performance/noImgElement: @flowpanel/react is framework-agnostic — a plain <img> avoids coupling to next/image.
      <img
        src={src}
        alt={alt ?? ""}
        width={px}
        height={px}
        className={cn("fp-rounded-full fp-object-cover", className)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "fp-flex fp-items-center fp-justify-center fp-rounded-full fp-bg-canvas fp-text-xs fp-font-medium fp-text-soft",
        sizeClass,
        className,
      )}
    >
      {initials}
    </div>
  );
}
