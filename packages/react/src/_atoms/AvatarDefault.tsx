export interface AvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE = { sm: 24, md: 32, lg: 48 } as const;
const SIZE_CLASS = { sm: "w-6 h-6", md: "w-8 h-8", lg: "w-12 h-12" } as const;

/** Pure renderer — no context dependency. Used as the registry default. */
export function DefaultAvatar({ src, alt, fallback, size = "md", className }: AvatarProps) {
  const px = SIZE[size];
  const sizeClass = SIZE_CLASS[size];
  const initials = (fallback ?? "").trim().slice(0, 2).toUpperCase() || "?";
  if (src) {
    return (
      <img
        src={src}
        alt={alt ?? ""}
        width={px}
        height={px}
        className={`rounded-full object-cover ${className ?? ""}`}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center rounded-full bg-fp-bg-2 text-xs font-medium text-fp-text-2 ${sizeClass} ${className ?? ""}`}
    >
      {initials}
    </div>
  );
}
