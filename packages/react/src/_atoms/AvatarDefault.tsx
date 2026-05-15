export interface AvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE = { sm: 24, md: 32, lg: 48 } as const;

/** Pure renderer — no context dependency. Used as the registry default. */
export function DefaultAvatar({ src, alt, fallback, size = "md", className }: AvatarProps) {
  const px = SIZE[size];
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
      style={{ width: px, height: px }}
      className={`flex items-center justify-center rounded-full bg-fp-bg-2 text-xs font-medium text-fp-text-2 ${className ?? ""}`}
    >
      {initials}
    </div>
  );
}
