import type { ReactNode } from "react";
import { cn } from "../utils/cn.js";

/**
 * Server-only mirror of `@flowpanel/react`'s `Card` shell.
 *
 * Why this exists: `@flowpanel/react` is bundled with a top-level
 * `"use client"` directive (because the bundle contains client components
 * like `DataTable`). Importing *any* symbol from `@flowpanel/react` into
 * a server render path therefore makes that path a client component, and
 * any function props (e.g. a user-authored `Component` for a `custom()`
 * widget) get rejected at the RSC boundary.
 *
 * Keeping a tiny visual-only `Card` here lets `render-widget.tsx` wrap
 * the user's server-rendered output in a frame *without* crossing into
 * the client bundle.
 *
 * No `"use client"`. No imports from `@flowpanel/react`. Internal — not
 * part of the public API surface.
 */
export interface ServerCardProps {
  children: ReactNode;
  className?: string;
}

export function ServerCard({ children, className }: ServerCardProps) {
  return (
    <div className={cn("rounded-fp border border-fp-border-1 bg-fp-bg-1", className)}>
      <div className="p-4">{children}</div>
    </div>
  );
}
