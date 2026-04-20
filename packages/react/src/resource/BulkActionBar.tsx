"use client";

import type { SerializedResource } from "@flowpanel/core";
import { X } from "lucide-react";
import { Button } from "../ui/button";
import { ResourceActionButton } from "./ResourceActionButton";

export function BulkActionBar({
  resource,
  baseUrl,
  selected,
  onClear,
  onSuccess,
}: {
  resource: SerializedResource;
  baseUrl: string;
  selected: Array<string | number>;
  onClear: () => void;
  onSuccess?: () => void;
}) {
  const bulkActions = resource.actions.filter((a) => a.type === "bulk");
  if (selected.length === 0 || bulkActions.length === 0) return null;

  const runSuccess = () => {
    onSuccess?.();
    onClear();
  };

  return (
    <div
      role="region"
      aria-label="Bulk action toolbar"
      className="sticky bottom-3 z-20 mx-auto flex w-full max-w-3xl items-center gap-3 rounded-full border border-border bg-background/95 px-4 py-2 shadow-lg backdrop-blur"
    >
      <span className="text-sm font-medium">{selected.length} selected</span>
      <div className="ml-auto flex items-center gap-2">
        {bulkActions.map((action) => (
          <ResourceActionButton
            key={action.id}
            action={action}
            resourceId={resource.id}
            baseUrl={baseUrl}
            recordIds={selected}
            onSuccess={runSuccess}
          />
        ))}
        <Button variant="ghost" size="sm" onClick={onClear} aria-label="Clear selection">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
