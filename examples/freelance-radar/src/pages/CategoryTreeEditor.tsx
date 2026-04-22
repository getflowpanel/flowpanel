"use client";

/**
 * Custom page: nested category tree with drag-and-drop parent reassignment.
 *
 * This is the kind of view that doesn't fit a resource table — it needs a
 * custom UI. FlowPanel lets you drop it in via `definePage({ component })`
 * and ship it in the same sidebar as generated resources.
 */
export function CategoryTreeEditor() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Categories</h1>
      <p className="text-sm text-muted-foreground">
        Drag nodes to reassign parents. Drop on the trash zone to delete.
      </p>
      <div className="rounded-lg border border-border p-4">
        {/* Real impl uses dnd-kit; stub for the 1.0 spec. */}
        <div className="text-sm text-muted-foreground">
          Tree editor goes here — FlowPanel is agnostic to the implementation.
        </div>
      </div>
    </div>
  );
}
