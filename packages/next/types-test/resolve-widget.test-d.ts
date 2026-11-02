import type {
  RequestContext,
  ResolvedAdminConfig,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import {
  type RequestWidgetContextOptions,
  type ResolvedWidget,
  requestWidgetContext,
  resolveWidget,
} from "@flowpanel/next";
import { expectAssignable, expectError, expectType } from "tsd";

declare const admin: ResolvedAdminConfig;
declare const reqCtx: RequestContext;
declare const widget: WidgetConfig;

const ctx = requestWidgetContext(admin, reqCtx, { resource: "users", row: { id: 1 } });
expectType<WidgetContext>(ctx);
expectType<Promise<ResolvedWidget>>(resolveWidget(widget, ctx));
expectAssignable<RequestWidgetContextOptions>({
  range: { from: new Date(), to: new Date(), preset: "last7d" },
});
expectError(requestWidgetContext(admin, reqCtx, { range: { from: new Date() } }));
expectError(requestWidgetContext(admin, { role: "admin" }));
