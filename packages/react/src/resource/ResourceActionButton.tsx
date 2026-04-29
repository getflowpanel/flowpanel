"use client";

/**
 * ResourceActionButton — the polymorphic button that handles all five
 * action kinds (mutation, bulk, collection, link, dialog). Keeps the
 * dispatcher thin: confirm logic goes through ConfirmDialog, dialog
 * forms go through DialogActionForm, download/envelope helpers live in
 * actionResult.ts.
 */

import type { SerializedAction } from "@flowpanel/core";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Button, buttonVariants } from "../ui/button";
import { toast } from "../ui/sonner";
import { cn } from "../utils/cn";
import { getNestedValue } from "../utils/getNestedValue";
import { type ActionDownload, extractResultData, triggerDownload } from "./actionResult";
import { DialogActionForm } from "./DialogActionForm";

interface BaseProps {
  action: SerializedAction;
  resourceId: string;
  baseUrl: string;
  onSuccess?: () => void;
  className?: string;
  /** Used for mutation/dialog row context; leave undefined for bulk/collection. */
  row?: Record<string, unknown>;
  /** For bulk: selected row ids. */
  recordIds?: Array<string | number>;
  /** Button size override */
  size?: "sm" | "default";
}

function substituteHref(template: string, row: Record<string, unknown> | undefined): string {
  if (!row) return template;
  return template.replace(/\{([^}]+)\}/g, (_, key) => {
    const v = getNestedValue(row, key.trim());
    return v === null || v === undefined ? "" : String(v);
  });
}

export function ResourceActionButton({
  action,
  resourceId,
  baseUrl,
  onSuccess,
  className,
  row,
  recordIds,
  size = "sm",
}: BaseProps) {
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!action.allowed) return null;

  const variant: "outline" | "destructive" =
    action.variant === "danger" ? "destructive" : "outline";

  // ──────────────────────────────────────────────────────────────
  // LINK action — renders as an <a>, no network call.
  // ──────────────────────────────────────────────────────────────
  if (action.type === "link") {
    const href = substituteHref(action.href, row);
    if (!href) return null;
    return (
      <a
        href={href}
        target={action.external ? "_blank" : undefined}
        rel={action.external ? "noopener noreferrer" : undefined}
        className={cn(buttonVariants({ variant, size }), className)}
      >
        {action.label}
        {action.external && <ExternalLink className="ml-1 h-3 w-3" aria-hidden="true" />}
      </a>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // MUTATION / BULK / COLLECTION / DIALOG — button-triggered POST.
  // ──────────────────────────────────────────────────────────────
  const runNetwork = async (path: string, body: Record<string, unknown>) => {
    setLoading(true);
    try {
      const response = await fetch(`${baseUrl}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Server returned ${response.status}`);
      }
      let result: unknown;
      try {
        result = await response.json();
      } catch {
        result = null;
      }
      const data = extractResultData(result);
      if (data && typeof data === "object" && "download" in data) {
        const dl = (data as { download?: ActionDownload }).download;
        if (dl) triggerDownload(dl);
      }
      toast.success(action.onSuccess?.toast ?? `${action.label} succeeded`);
      onSuccess?.();
    } catch (err) {
      toast.error(`${action.label} failed`, {
        description: (err as Error).message,
      });
    } finally {
      setLoading(false);
    }
  };

  const runMutation = () =>
    runNetwork("flowpanel.resource.action", {
      resourceId,
      actionId: action.id,
      recordId: row?.id,
    });

  const runBulk = () =>
    runNetwork("flowpanel.resource.actionBulk", {
      resourceId,
      actionId: action.id,
      recordIds: recordIds ?? [],
    });

  const runCollection = () =>
    runNetwork("flowpanel.resource.actionCollection", {
      resourceId,
      actionId: action.id,
    });

  const runDialog = async (values: Record<string, unknown>) => {
    await runNetwork("flowpanel.resource.actionDialog", {
      resourceId,
      actionId: action.id,
      values,
      recordId: row?.id,
    });
  };

  const requestRun = () => {
    if (action.confirm) {
      setConfirmOpen(true);
      return;
    }
    triggerRun();
  };

  const triggerRun = () => {
    if (action.type === "dialog") {
      setDialogOpen(true);
      return;
    }
    if (action.type === "mutation") void runMutation();
    else if (action.type === "bulk") void runBulk();
    else if (action.type === "collection") void runCollection();
  };

  const confirmTitle = action.confirm?.title ?? `${action.label}?`;
  const rawDesc = action.confirm?.description;
  const confirmDesc =
    (typeof rawDesc === "string" ? rawDesc : undefined) ??
    `Are you sure you want to ${action.label.toLowerCase()}?`;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={requestRun}
        loading={loading}
        disabled={action.type === "bulk" && (!recordIds || recordIds.length === 0)}
      >
        {action.label}
        {action.type === "bulk" && recordIds && recordIds.length > 0 && (
          <span className="ml-1.5 rounded bg-background/20 px-1.5 py-0.5 text-xs font-mono">
            {recordIds.length}
          </span>
        )}
      </Button>

      {action.confirm && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={confirmTitle}
          description={confirmDesc}
          confirmLabel={action.confirm.confirmLabel ?? action.label}
          typeToConfirm={action.confirm.typeToConfirm}
          destructive={action.variant === "danger" || action.confirm.intent === "destructive"}
          onConfirm={triggerRun}
        />
      )}

      {action.type === "dialog" && (
        <DialogActionForm
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          action={action}
          onSubmit={runDialog}
          loading={loading}
        />
      )}
    </>
  );
}
