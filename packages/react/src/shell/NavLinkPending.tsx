"use client";
import { useLinkStatus } from "next/link";
import { cn } from "../lib/cn";

/** Inside a nav `Link`: a sweeping line while the page it opens is on its way. */
export function NavLinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return pending ? (
    <span aria-hidden className={cn("fp-pending-bar fp-absolute", className)} />
  ) : null;
}
