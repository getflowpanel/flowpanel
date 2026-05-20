/**
 * Class-name joiner — local copy to avoid importing from `@flowpanel/react`,
 * which is bundled with `"use client"` and would re-poison this server bundle
 * with a client boundary.
 *
 * Behaviourally equivalent to `@flowpanel/react`'s `cn`: `twMerge(clsx(...))`.
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
