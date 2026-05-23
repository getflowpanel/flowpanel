import type { ActionContext } from "./context.js";
import type { InferDB } from "./registry.js";
import type { WidgetConfig } from "./widget.js";

export type DrawerWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

export interface DrawerTabFields {
  key: string;
  label: string;
  fields: "*" | string[];
}

export interface DrawerTabResource {
  key: string;
  label: string;
  resource: string;
  filter?: (row: unknown) => Record<string, unknown>;
}

export interface DrawerTabWidgets {
  key: string;
  label: string;
  widgets: WidgetConfig[];
}

// NOTE: a fourth `DrawerTabCustom` variant — drop-in user React component as
// a drawer tab — is planned for 1.0.x but not shipped in 1.0.0 because the
// RSC-boundary component-reference plumbing deserves a focused round (see
// `docs/spec/1.x-roadmap-to-10-of-10.md` item 0.6). Until then, custom
// per-row viewers (e.g. AI-log prompt/response side-by-side) can be wired
// via `resource.options.detail.tabs[].render` on the detail page.

export type DrawerTab = DrawerTabFields | DrawerTabResource | DrawerTabWidgets;

export interface DrawerFieldFormSpec {
  name: string;
  type?: "text" | "textarea" | "select" | "switch" | "number";
  options?: string[];
}

export interface DrawerAction<DB = InferDB> {
  key: string;
  label: string;
  variant?: "default" | "destructive";
  icon?: string;
  confirm?: string;
  form?: DrawerFieldFormSpec[];
  palette?: boolean;
  run: (
    row: unknown,
    formData: Record<string, unknown>,
    ctx: ActionContext<DB>,
  ) => Promise<{ ok: boolean; message?: string; refresh?: boolean | string | string[] }>;
}

export interface DrawerConfig {
  width?: DrawerWidth;
  header?: (row: unknown) => string;
  fields?: "*" | string[];
  tabs?: DrawerTab[];
  actions?: DrawerAction[];
  viewDetailsLink?: boolean;
}
