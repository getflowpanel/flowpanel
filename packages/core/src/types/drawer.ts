import type { Session } from "./session.js";
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

export type DrawerTab = DrawerTabFields | DrawerTabResource | DrawerTabWidgets;

export interface DrawerFieldFormSpec {
  name: string;
  type?: "text" | "textarea" | "select" | "switch" | "number";
  options?: string[];
}

export interface DrawerAction {
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
    ctx: { session: Session | null },
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
