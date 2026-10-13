import { cn } from "../lib/cn";

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
          className="fp-h-5 fp-w-5 fp-shrink-0 fp-object-contain"
        />
      ) : null}
      <span className="fp-truncate">{name}</span>
    </>
  );
  const base = "fp-flex fp-items-center fp-gap-2 fp-text-sm fp-font-semibold fp-text-ink";
  if (brand?.href) {
    return (
      <a
        href={brand.href}
        className={cn(
          base,
          "fp-rounded-sm hover:fp-opacity-80 focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60",
          className,
        )}
      >
        {inner}
      </a>
    );
  }
  return <div className={cn(base, className)}>{inner}</div>;
}
