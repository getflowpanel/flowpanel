"use client";

import { Plus, Inbox } from "lucide-react";
import type { SerializedResource } from "@flowpanel/core";
import { Button } from "../ui/button";

export function ResourceEmptyState({
  resource,
  onCreateClick,
}: {
  resource: SerializedResource;
  onCreateClick?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
      <Inbox className="h-12 w-12 mb-4 opacity-30" />
      <p className="text-base font-medium text-foreground mb-1">
        No {resource.labelPlural.toLowerCase()} yet
      </p>
      <p className="text-sm mb-6">
        Get started by creating your first {resource.label.toLowerCase()}.
      </p>
      {resource.access.create && onCreateClick && (
        <Button size="sm" onClick={onCreateClick}>
          <Plus className="h-4 w-4 mr-1" />
          New {resource.label}
        </Button>
      )}
    </div>
  );
}
