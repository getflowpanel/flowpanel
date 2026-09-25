import type { ResolvedAdminConfig, WidgetConfig, WidgetContext } from "@flowpanel/core";
import {
  type AdminWidgetContextOptions,
  adminWidgetContext,
  type ResolvedWidget,
  resolveWidget,
} from "@flowpanel/next";
import { expectAssignable, expectError, expectType } from "tsd";

declare const admin: ResolvedAdminConfig;
declare const widget: WidgetConfig;

const ctx = adminWidgetContext(admin, { role: "support", resource: "users", row: { id: 1 } });
expectType<WidgetContext>(ctx);
expectType<Promise<ResolvedWidget>>(resolveWidget(widget, ctx));
expectAssignable<AdminWidgetContextOptions>({
  range: { from: new Date(), to: new Date(), preset: "last7d" },
});
expectError(adminWidgetContext(admin, { range: { from: new Date() } }));
expectError(adminWidgetContext(admin, { role: 1 }));
