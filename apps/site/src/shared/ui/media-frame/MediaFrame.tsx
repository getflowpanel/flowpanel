import Image from "next/image";

interface MediaFrameProps {
  /** Screenshot for the dark theme. */
  srcDark: string;
  /** Screenshot for the light theme. */
  srcLight: string;
  alt: string;
  width: number;
  height: number;
  /** Address shown in the fake browser bar. */
  url?: string;
  /** Render eagerly (use for the above-the-fold hero shot). */
  priority?: boolean;
}

/**
 * Browser-chrome wrapper around the hero product shot. Renders both theme
 * variants; `globals.css` shows the one matching the active theme (the site
 * has no Tailwind `dark:` variant — themes flip via CSS-var tokens).
 *
 * SWAP POINT: when the console→admin walkthrough video is ready, replace the
 * `<Image>`s below with a `<video>` of the same aspect ratio — the chrome,
 * sizing, and surrounding layout stay identical, so nothing else moves.
 */
export function MediaFrame({
  srcDark,
  srcLight,
  alt,
  width,
  height,
  url = "localhost:3000/admin",
  priority = false,
}: MediaFrameProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-frame)]">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
        <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[var(--color-border-strong)]" />
        <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[var(--color-border-strong)]" />
        <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[var(--color-border-strong)]" />
        <span className="ml-3 truncate rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 font-mono text-xs text-[var(--color-fg-subtle)]">
          {url}
        </span>
      </div>
      <Image
        data-fp-media="light"
        src={srcLight}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className="h-auto w-full"
      />
      <Image
        data-fp-media="dark"
        src={srcDark}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className="h-auto w-full"
      />
    </div>
  );
}
