import { type AccessContext, queue, type ResourceOptions, requireAccess } from "@flowpanel/core";
import { expectAssignable, expectError } from "tsd";

declare const condition: { sql: string };

expectAssignable<ResourceOptions<{ id: string }>>({
  scope: (_scope, query: { where(c: typeof condition): unknown }) => query.where(condition),
});
expectAssignable<ResourceOptions<{ id: string }>>({
  scope: (scope, where: Record<string, unknown>) => ({ ...where, tenantId: scope?.tenantId }),
});
expectAssignable<ResourceOptions<{ id: string }>>({ scope: "bypass" });

declare const bullQueue: { readonly name: string; add(job: string): Promise<void> };
queue(bullQueue, { label: "Emails", boardUrl: "/board" });
queue({}, { label: "Emails", key: "emails", boardUrl: "/board" });
expectError(queue("emails", { label: "Emails", boardUrl: "/board" }));

declare const accessContext: AccessContext;
expectError(requireAccess(undefined, accessContext));
requireAccess(["admin", "support"], accessContext);
