"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

export type SandboxNoticeState = "idle" | "pending" | "restored" | "rate_limited" | "error";

export function sandboxNoticeBadge(readOnly: boolean): string {
  return readOnly ? "Demo maintenance" : "Interactive sandbox";
}

export function sandboxNoticeCopy(state: SandboxNoticeState, readOnly = false): string {
  if (readOnly) return "Editing is temporarily disabled while this demo is being maintained.";
  if (state === "pending") return "Restoring the original demo data…";
  if (state === "restored") return "Original demo data restored for this browser.";
  if (state === "rate_limited") return "Please wait a moment before resetting again.";
  if (state === "error") return "Could not reset the demo. Please try again.";
  return "Private to this browser. Resets after 60 minutes of inactivity.";
}

export function DemoSandboxNotice({ readOnly }: { readOnly: boolean }) {
  const router = useRouter();
  const [state, setState] = React.useState<SandboxNoticeState>("idle");
  const [isPending, startTransition] = React.useTransition();
  const pending = isPending || state === "pending";

  const reset = () => {
    setState("pending");
    startTransition(async () => {
      try {
        const response = await fetch("/api/demo/reset", { method: "POST" });
        if (response.ok) {
          setState("restored");
          router.refresh();
          return;
        }
        setState(response.status === 429 ? "rate_limited" : "error");
      } catch {
        setState("error");
      }
    });
  };

  return (
    <aside className="border-b border-demo-border bg-demo-surface">
      <div className="mx-auto flex min-h-11 max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-xs sm:px-6">
        <span className="font-medium text-demo-text">{sandboxNoticeBadge(readOnly)}</span>
        <span
          aria-live="polite"
          className="order-3 w-full min-w-0 pb-1 text-demo-muted sm:order-none sm:w-auto sm:flex-1 sm:pb-0"
        >
          {sandboxNoticeCopy(state, readOnly)}
        </span>
        {!readOnly ? (
          <button
            type="button"
            onClick={reset}
            disabled={pending}
            className="ml-auto inline-flex min-h-11 shrink-0 items-center rounded-sm px-2.5 font-medium text-demo-accent transition-colors hover:bg-demo-accent/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-demo-accent/60 disabled:cursor-wait disabled:opacity-60 sm:min-h-8"
          >
            {pending ? "Restoring…" : "Reset data"}
          </button>
        ) : null}
      </div>
    </aside>
  );
}
