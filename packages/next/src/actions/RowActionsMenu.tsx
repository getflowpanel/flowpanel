"use client";
import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  triggerDownload,
  useToast,
} from "@flowpanel/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { SerializedRowAction } from "./row-action.js";

/**
 * Trailing per-row menu rendered in the last cell of a resource list table
 * when `resource.options.actions` is non-empty.
 *
 * Actions with `placement: "inline"` render as outlined buttons; the rest go
 * into a kebab dropdown. On click:
 *
 * 1. If `action.confirm` is set → show the AlertDialog confirm.
 * 2. POST `/api/flowpanel/<resource>/<id>/actions/<key>`.
 * 3. Surface the `ActionResult`:
 *    - `ok: true` + `message` → success toast (falls back to "<label> ran")
 *    - `ok: true` + `download` → browser download via `triggerDownload`
 *    - `ok: true` + `redirect` → navigate via `router.push`
 *    - `ok: false` → error toast with the message
 * 4. `router.refresh()` so the list re-renders with the new server state
 *    (unless we navigated away).
 *
 * `hidden` and `disabled` are enforced server-side (see `rowActionRoute`);
 * we don't pre-filter on the client. A hand-crafted POST hitting a hidden
 * row gets a 404 — same as a stale UI state would. Per-row client-side
 * disable will land alongside the `prerender-cells` per-row action map.
 */
export interface RowActionsMenuProps {
  resource: string;
  id: string;
  actions: SerializedRowAction[];
}

type ServerResult =
  | {
      ok: true;
      message?: string;
      redirect?: string;
      download?: { filename: string; data: string; mime?: string };
    }
  | { ok: false; error: string };

export function RowActionsMenu({ resource, id, actions }: RowActionsMenuProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<SerializedRowAction | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);

  const menuActions = actions.filter((a) => a.placement !== "inline");
  const inlineActions = actions.filter((a) => a.placement === "inline");

  if (menuActions.length === 0 && inlineActions.length === 0) return null;

  async function execute(action: SerializedRowAction): Promise<void> {
    setPending(action.key);
    try {
      const res = await fetch(`/api/flowpanel/${resource}/${id}/actions/${action.key}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const result = (await res.json()) as ServerResult;

      if (!result.ok) {
        toast.error(result.error || `${action.label} failed`);
        return;
      }

      toast.success(result.message ?? `${action.label} ran`);

      if (result.download) {
        triggerDownload(result.download);
      }
      if (result.redirect) {
        router.push(result.redirect);
      } else {
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setPending(null);
    }
  }

  function onActionClick(action: SerializedRowAction): void {
    setMenuOpen(false);
    if (action.confirm) {
      setConfirming(action);
      return;
    }
    void execute(action);
  }

  return (
    <div
      role="toolbar"
      aria-label="Row actions"
      className="flex items-center justify-end gap-1"
      // Prevent row-click handlers (drawer open) from firing when the user
      // is interacting with the action menu.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {inlineActions.map((a) => (
        <Button
          key={a.key}
          size="sm"
          variant={a.variant === "destructive" ? "destructive" : "outline"}
          disabled={pending === a.key}
          onClick={() => onActionClick(a)}
          aria-busy={pending === a.key || undefined}
        >
          {a.label}
        </Button>
      ))}

      {menuActions.length > 0 ? (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Row actions"
              className="inline-flex h-7 w-7 items-center justify-center rounded-fp-sm text-fp-text-3 hover:bg-fp-bg-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-border-3"
              disabled={pending !== null}
            >
              <KebabIcon />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {menuActions.map((a) => (
              <DropdownMenuItem
                key={a.key}
                disabled={pending === a.key}
                onSelect={() => onActionClick(a)}
                className={a.variant === "destructive" ? "text-fp-danger" : undefined}
              >
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {confirming ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirming(null);
          }}
          title={confirming.confirm?.title ?? `Run ${confirming.label}?`}
          {...(confirming.confirm?.description
            ? { description: confirming.confirm.description }
            : {})}
          confirmLabel={confirming.confirm?.confirmLabel ?? confirming.label}
          variant={confirming.variant === "destructive" ? "destructive" : "default"}
          onConfirm={async () => {
            const action = confirming;
            setConfirming(null);
            await execute(action);
          }}
        />
      ) : null}
    </div>
  );
}

function KebabIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="12" cy="19" r="1.2" />
    </svg>
  );
}
