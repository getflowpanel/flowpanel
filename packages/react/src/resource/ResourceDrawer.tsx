"use client";

import { useState } from "react";
import type { SerializedResource } from "@flowpanel/core";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { Button } from "../ui/button";
import { cn } from "../utils/cn";
import { CellRenderer } from "./cells";
import { ResourceForm } from "./ResourceForm";

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function DetailGrid({
  resource,
  row,
}: {
  resource: SerializedResource;
  row: Record<string, unknown>;
}) {
  const detailColumns = resource.columns.filter(
    (c) => c.opts.visible !== "list" || c.opts.visible === "always",
  );

  return (
    <div className="grid grid-cols-2 gap-4">
      {detailColumns.map((col) => {
        const value = col.path ? getNestedValue(row, col.path) : undefined;
        return (
          <div key={col.id} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {col.label}
            </span>
            <span className="text-sm break-words">
              <CellRenderer column={col} value={value} row={row} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ActionButton({
  action,
  row,
  baseUrl,
  onSuccess,
}: {
  action: SerializedResource["actions"][number];
  row: Record<string, unknown>;
  baseUrl: string;
  onSuccess?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!action.allowed) return null;

  const handleClick = async () => {
    if (action.confirm) {
      const confirmMsg =
        typeof action.confirm.description === "string"
          ? action.confirm.description
          : (action.confirm.title ?? `Are you sure you want to ${action.label.toLowerCase()}?`);
      if (!window.confirm(confirmMsg)) return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${baseUrl}/flowpanel.resource.action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: "", actionId: action.id, row }),
      });
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      onSuccess?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant={action.variant === "danger" ? "destructive" : "outline"}
        size="sm"
        onClick={() => void handleClick()}
        disabled={loading}
      >
        {loading ? "Running…" : action.label}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ResourceDrawer({
  resource,
  mode,
  row,
  open,
  onClose,
  baseUrl,
  onSuccess,
}: {
  resource: SerializedResource;
  mode: "detail" | "create" | "edit";
  row?: Record<string, unknown>;
  open: boolean;
  onClose: () => void;
  baseUrl: string;
  onSuccess?: () => void;
}) {
  const title =
    mode === "create"
      ? `New ${resource.label}`
      : mode === "edit"
        ? `Edit ${resource.label}`
        : resource.label;

  const handleSuccess = (savedRow: Record<string, unknown>) => {
    onSuccess?.();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        className={cn("w-full sm:max-w-lg flex flex-col gap-0 p-0 overflow-hidden")}
        side="right"
      >
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {mode === "detail" && row && (
            <div className="flex flex-col gap-6">
              {/* Action buttons */}
              {resource.actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {resource.actions.map((action) => (
                    <ActionButton
                      key={action.id}
                      action={action}
                      row={row}
                      baseUrl={baseUrl}
                      onSuccess={onSuccess}
                    />
                  ))}
                  {resource.access.update && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Signal parent to switch to edit mode
                        onSuccess?.();
                      }}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              )}

              <DetailGrid resource={resource} row={row} />
            </div>
          )}

          {(mode === "create" || mode === "edit") && (
            <ResourceForm
              resource={resource}
              row={mode === "edit" ? row : undefined}
              baseUrl={baseUrl}
              onSuccess={handleSuccess}
              onCancel={onClose}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
