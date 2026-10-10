"use client";
import type { toast } from "sonner";

type SonnerToast = typeof toast;
type Dispatch = (t: SonnerToast) => void;

let bound: SonnerToast | null = null;
const queued: Dispatch[] = [];

/** Called once the renderer has mounted and subscribed, so nothing dispatched earlier is dropped. */
export function bindToaster(t: SonnerToast): () => void {
  bound = t;
  for (const job of queued.splice(0)) job(t);
  return () => {
    bound = null;
  };
}

export function dispatchToast(job: Dispatch): void {
  if (bound) job(bound);
  else queued.push(job);
}
