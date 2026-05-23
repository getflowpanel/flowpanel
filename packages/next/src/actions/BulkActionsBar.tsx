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
import type { SerializedBulkAction } from "./bulk-action.js";

/**
 * Floating bar rendered above a resource list when one or more rows are
 * selected and `resource.options.bulkActions` is non-empty.
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  N selected      [Action ▾]      [Clear]                    │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * On selecting an action:
 *
 * 1. If `action.confirm` is set → AlertDialog confirm.
 * 2. POST `/api/flowpanel/<resource>/bulk-actions/<key>` with
 *    `{ ids: selection }` as JSON.
 * 3. Surface the `ActionResult`:
 *    - `ok: true` + `message` → success toast (fallback to "Done")
 *    - `ok: true` + `download` → browser download
 *    - `ok: true` + `redirect` → navigate
 *    - `ok: false` → error toast
 * 4. Clear the selection and `router.refresh()` unless we navigated away.
 *
 * The action body is sent JSON-only by this component — bulk actions with
 * `form` (interactive inputs collected before run) land alongside row-action
 * form support in the same follow-up.
 */
export interface BulkActionsBarProps {
  resource: string;
  selection: string[];
  onClear: () => void;
  actions: SerializedBulkAction[];
}

type ServerResult =
  | {
      ok: true;
      message?: string;
      redirect?: string;
      download?: { filename: string; data: string; mime?: string };
    }
  | { ok: false; error: string };

export function BulkActionsBar({ resource, selection, onClear, actions }: BulkActionsBarProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<SerializedBulkAction | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);

  if (selection.length === 0 || actions.length === 0) return null;

  async function execute(action: SerializedBulkAction): Promise<void> {
    setPending(action.key);
    try {
      const res = await fetch(`/api/flowpanel/${resource}/bulk-actions/${action.key}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: selection }),
      });
      const result = (await res.json()) as ServerResult;

      if (!result.ok) {
        toast.error(result.error || `${action.label} failed`);
        return;
      }

      toast.success(result.message ?? `${action.label} ran on ${selection.length}`);

      if (result.download) {
        triggerDownload(result.download);
      }
      if (result.redirect) {
        router.push(result.redirect);
        return;
      }
      onClear();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setPending(null);
    }
  }

  function onActionPick(action: SerializedBulkAction): void {
    setMenuOpen(false);
    if (action.confirm) {
      setConfirming(action);
      return;
    }
    void execute(action);
  }

  return (
    <section
      aria-label="Bulk actions"
      className="mb-2 flex items-center justify-between gap-3 rounded-fp border border-fp-border-1 bg-fp-bg-2 px-3 py-2"
    >
      <div className="text-sm text-fp-text-2">
        <span className="font-medium text-fp-text-1">{selection.length}</span> selected
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="default" disabled={pending !== null}>
              Action…
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {actions.map((a) => (
              <DropdownMenuItem
                key={a.key}
                disabled={pending === a.key}
                onSelect={() => onActionPick(a)}
                className={a.variant === "destructive" ? "text-fp-danger" : undefined}
              >
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="ghost" onClick={onClear} disabled={pending !== null}>
          Clear
        </Button>
      </div>
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
          confirmLabel={`${confirming.label} (${selection.length})`}
          variant={confirming.variant === "destructive" ? "destructive" : "default"}
          onConfirm={async () => {
            const action = confirming;
            setConfirming(null);
            await execute(action);
          }}
        />
      ) : null}
    </section>
  );
}
