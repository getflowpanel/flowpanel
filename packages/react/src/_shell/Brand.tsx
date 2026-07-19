export interface ShellBrand {
  name?: string;
  logo?: string;
  href?: string;
}

export interface BrandProps {
  brand?: ShellBrand | undefined;
  fallback?: string;
  className?: string;
}

/** Logo + product name in the shell chrome, linked when `href` is set. */
export function Brand({ brand, fallback = "Admin", className }: BrandProps) {
  const name = brand?.name ?? fallback;
  const inner = (
    <>
      {brand?.logo ? (
        // biome-ignore lint/performance/noImgElement: next/image would pull a Next-only dep into the shared UI package
        <img
          src={brand.logo}
          alt=""
          aria-hidden="true"
          className="h-5 w-5 shrink-0 object-contain"
        />
      ) : null}
      <span className="truncate">{name}</span>
    </>
  );
  const classes = `flex items-center gap-2 text-sm font-semibold text-fp-text-1 ${className ?? ""}`;
  if (brand?.href) {
    return (
      <a
        href={brand.href}
        className={`${classes} rounded-fp-sm hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/40`}
      >
        {inner}
      </a>
    );
  }
  return <div className={classes}>{inner}</div>;
}
