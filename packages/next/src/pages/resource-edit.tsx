import type { ItemQueryContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { checkRequireRole, type RequireRole, runWithRequestContext } from "@flowpanel/core";
import { AutoForm, PageHeader } from "@flowpanel/react";
import { makeFormAction } from "../actions/resource-actions.js";
import { buildRequestContext } from "../runtime/request-setup.js";
import { NotFound } from "./not-found.js";
import { pickSchema } from "./resource-create.js";

export interface ResourceEditPageProps {
  config: ResolvedAdminConfig;
  resource: ResourceConfig;
  name: string;
  id: string;
  req: Request;
}

export async function ResourceEditPage({ config, resource, name, id, req }: ResourceEditPageProps) {
  const reqCtx = await buildRequestContext({ req, config });
  checkRequireRole(resource.options.requireRole as RequireRole, reqCtx.role, reqCtx.session);

  if (resource.options.update?.disabled) {
    return <div className="text-fp-text-3">Editing is disabled for this resource.</div>;
  }

  const ctx: ItemQueryContext = {
    ...reqCtx,
    db: config.adapter.db,
    dateRange: { from: new Date(0), to: new Date() },
    searchParams: new URLSearchParams(),
    signal: new AbortController().signal,
    id,
  };
  const row = (await runWithRequestContext(reqCtx, () =>
    config.adapter.get(resource.ref, ctx),
  )) as Record<string, unknown> | null;
  if (!row) return <NotFound />;

  const intro = config.adapter.introspect(resource.ref);
  const schema = pickSchema(config, resource, "update");
  const action = makeFormAction(config, resource, "update", id);

  return (
    <>
      <PageHeader title={`Edit ${resource.options.label ?? name}`} />
      <div className="max-w-xl rounded-fp border border-fp-border-1 bg-fp-bg-1 p-6">
        <AutoForm
          action={action}
          schema={schema}
          columns={intro.columns}
          defaultValues={row}
          submitLabel="Save"
        />
      </div>
    </>
  );
}
