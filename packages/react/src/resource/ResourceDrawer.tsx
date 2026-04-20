"use client";

import type { SerializedResource } from "@flowpanel/core";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { cn } from "../utils/cn";
import { getNestedValue } from "../utils/getNestedValue";
import { CellRenderer } from "./cells";
import { ResourceActionButton } from "./ResourceActionButton";
import { ResourceForm } from "./ResourceForm";

function DetailGrid({
  resource,
  row,
}: {
  resource: SerializedResource;
  row: Record<string, unknown>;
}) {
  const detailColumns = resource.columns.filter((c) => c.opts.visible !== "list");

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

  const handleSuccess = (_savedRow: Record<string, unknown>) => {
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
              {/* Action buttons — per-row actions (mutation, link, dialog). Bulk/collection are shown on the page toolbar. */}
              {resource.actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {resource.actions
                    .filter(
                      (a) => a.type === "mutation" || a.type === "link" || a.type === "dialog",
                    )
                    .map((action) => (
                      <ResourceActionButton
                        key={action.id}
                        action={action}
                        row={row}
                        baseUrl={baseUrl}
                        resourceId={resource.id}
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
