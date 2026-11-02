import type { DrawerPayload } from "../drawer-route";

/** The record half of a drawer payload: a live row with no actions of its own. */
export const RECORD_DEFAULTS = {
  deleted: false,
  restorable: false,
  rowActions: [],
  editHref: null,
  delete: null,
  references: {},
} satisfies Partial<DrawerPayload>;
