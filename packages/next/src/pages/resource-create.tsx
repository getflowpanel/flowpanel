import type { ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { checkRequireRole, type RequireRole } from "@flowpanel/core";
import { AutoForm, PageHeader } from "@flowpanel/react";
import type { z } from "zod";
import { makeFormAction } from "../actions/resource-actions.js";
import { buildRequestContext } from "../runtime/request-setup.js";

export interface ResourceCreatePageProps {
  config: ResolvedAdminConfig;
  resource: ResourceConfig;
  name: string;
  req: Request;
}

function pickSchema(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  kind: "create" | "update",
): z.ZodTypeAny {
  const userSchema = resource.options.schema;
  if (userSchema) {
    if (typeof userSchema === "object" && kind in userSchema) {
      const picked = (userSchema as { create?: z.ZodTypeAny; update?: z.ZodTypeAny })[kind];
      if (picked) return picked;
    }
    if (typeof userSchema === "object" && !("create" in userSchema) && !("update" in userSchema)) {
      return userSchema as z.ZodTypeAny;
    }
  }
  return config.adapter.inferSchema(resource.ref)[kind];
}

export async function ResourceCreatePage({ config, resource, name, req }: ResourceCreatePageProps) {
  const reqCtx = await buildRequestContext({ req, config });
  checkRequireRole(resource.options.requireRole as RequireRole, reqCtx.role, reqCtx.session);

  if (resource.options.create?.disabled) {
    return <div className="text-fp-text-3">Create is disabled for this resource.</div>;
  }

  const intro = config.adapter.introspect(resource.ref);
  const schema = pickSchema(config, resource, "create");
  const action = makeFormAction(config, resource, "create");

  return (
    <>
      <PageHeader title={`New ${resource.options.label ?? name}`} />
      <div className="max-w-xl rounded-fp border border-fp-border-1 bg-fp-bg-1 p-6">
        <AutoForm action={action} schema={schema} columns={intro.columns} submitLabel="Create" />
      </div>
    </>
  );
}

export { pickSchema };
