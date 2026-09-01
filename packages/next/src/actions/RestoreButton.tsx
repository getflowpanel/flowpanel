"use client";
import { Button, useApiBase, useLabels, useToast } from "@flowpanel/react";
import { useRouter } from "next/navigation";
import * as React from "react";

export interface RestoreButtonProps {
  resource: string;
  id: string;
}

export function RestoreButton({ resource, id }: RestoreButtonProps) {
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
      const result = (await res.json()) as
        | { ok: true }
        | { ok: false; error?: string | { message?: string } };
      if (!result.ok) {
        const message = typeof result.error === "string" ? result.error : result.error?.message;
        toast.error(message || `${labels.actions.restore} failed`);
        return;
      }
      toast.success(labels.actions.restore);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
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
