import type { DrawerAction } from "@flowpanel/core";

/** Wire-safe shape of `DrawerAction`. */
export interface SerializedDrawerAction {
  key: string;
  label: string;
  variant?: "default" | "destructive";
  placement?: "inline" | "menu";
  confirm?: string;
  form?: DrawerAction["form"];
  palette?: boolean;
}

/** Wire-safe shape of one `drawer.actions` entry. */
export function serializeDrawerAction(a: DrawerAction): SerializedDrawerAction {
  const out: SerializedDrawerAction = { key: a.key, label: a.label };
  if (a.variant !== undefined) out.variant = a.variant;
  if (a.placement !== undefined) out.placement = a.placement;
  if (a.confirm !== undefined) out.confirm = a.confirm;
  if (a.form !== undefined) out.form = a.form;
  if (a.palette !== undefined) out.palette = a.palette;
  return out;
}
