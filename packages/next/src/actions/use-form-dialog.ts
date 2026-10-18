"use client";
import { useLabels, useToast } from "@flowpanel/react";
import * as React from "react";
import type { ActionFormDialogProps } from "./ActionFormDialog";

/** An action's form dialog, whose code loads the first time one opens, so a page without one never fetches it. */
export function useFormDialog(): {
  FormDialog: React.ComponentType<ActionFormDialogProps> | null;
  whenLoaded: (open: () => void) => void;
} {
  const [FormDialog, setFormDialog] =
    React.useState<React.ComponentType<ActionFormDialogProps> | null>(null);
  const toast = useToast();
  const { errors } = useLabels();
  const whenLoaded = (open: () => void) => {
    if (FormDialog) {
      open();
      return;
    }
    import("./ActionFormDialog").then(
      (loaded) => {
        setFormDialog(() => loaded.ActionFormDialog);
        open();
      },
      () => toast.error(errors.network),
    );
  };
  return { FormDialog, whenLoaded };
}
