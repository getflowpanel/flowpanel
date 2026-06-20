import type { ItemQueryContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { checkRequireRole, runWithRequestContext } from "@flowpanel/core";
import { AutoForm, PageHeader } from "@flowpanel/react";
import { buildHref } from "../runtime/href.js";
import { buildRequestContext } from "../runtime/request-setup.js";
import { declaredFormFields, resolveFormFields } from "../runtime/resolve-form-fields.js";
import { scopeBinding } from "../runtime/scope-binding.js";
import { NotFound } from "./not-found.js";

export interface ResourceEditPageProps {
  config: ResolvedAdminConfig;
  resource: ResourceConfig;
  name: string;
  id: string;
  req: Request;
}

export async function ResourceEditPage({ config, resource, name, id, req }: ResourceEditPageProps) {
  const reqCtx = await buildRequestContext({ req, config });
  checkRequireRole(resource.options.requireRole, reqCtx.role, reqCtx.session);

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
    ...scopeBinding(config, resource, reqCtx),
  };
  const row = (await runWithRequestContext(reqCtx, () =>
    config.adapter.get(resource.ref, ctx),
  )) as Record<string, unknown> | null;
  if (!row) return <NotFound />;

  const intro = config.adapter.introspect(resource.ref);
  const action = `/api/flowpanel/${name}/${id}/edit`;
  const declared = declaredFormFields(resource, "update");
  const fields = declared ? await resolveFormFields(config, declared, reqCtx, row) : undefined;

  return (
    <>
      <PageHeader title={`Edit ${resource.options.label ?? name}`} />
      <div className="max-w-xl rounded-fp border border-fp-border-1 bg-fp-bg-1 p-6">
        <AutoForm
          action={action}
          columns={intro.columns}
          defaultValues={row}
          {...(fields ? { fields } : {})}
          submitLabel="Save"
          redirectTo={buildHref(config, name, id)}
        />
      </div>
    </>
  );
}
