"use client";
import { formatLabel } from "@flowpanel/core/labels";
import { Button, connectionMessage, useApiBase, useLabels, useToast } from "@flowpanel/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { readActionFailure } from "./read-action-failure";

export interface RestoreButtonProps {
  resource: string;
  id: string;
  /** Runs once the row is back, after the page refreshed. */
  onRestored?: () => void;
}

export function RestoreButton({ resource, id, onRestored }: RestoreButtonProps) {
  const router = useRouter();
  const apiBase = useApiBase();
  const toast = useToast();
  const labels = useLabels();
  const [pending, setPending] = React.useState(false);

  async function restore(): Promise<void> {
    setPending(true);
    try {
      const res = await fetch(
        `${apiBase}/${encodeURIComponent(resource)}/${encodeURIComponent(id)}/restore`,
        { method: "POST" },
      );
      const result = (await res.json()) as { ok: boolean };
      if (!result.ok) {
        toast.error(
          readActionFailure(result, labels.errors).message ||
            formatLabel(labels.errors.actionFailed, { label: labels.actions.restore }),
        );
        return;
      }
      toast.success(labels.actions.restore);
      router.refresh();
      onRestored?.();
    } catch {
      toast.error(connectionMessage(labels.errors));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation();
        void restore();
      }}
      aria-busy={pending || undefined}
    >
      {labels.actions.restore}
    </Button>
  );
}
