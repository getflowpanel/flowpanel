import type {
  ItemQueryContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import {
  authorizeOperation,
  checkRequireRole,
  resolveOperationAccess,
  runWithRequestContext,
} from "@flowpanel/core";
import { AutoForm, PageHeader } from "@flowpanel/react";
import { buildHref } from "../runtime/href";
import { buildRequestContext } from "../runtime/request-setup";
import { declaredFormFields, resolveFormFields } from "../runtime/resolve-form-fields";
import { scopeBinding } from "../runtime/scope-binding";
import { NotFound } from "./not-found";

export interface ResourceEditPageProps {
  config: ResolvedAdminConfig;
  resource: ResourceConfig;
  name: string;
  id: string;
  req: Request;
  reqCtx?: RequestContext;
}

export async function ResourceEditPage({
  config,
  resource,
  name,
  id,
  req,
  reqCtx: providedReqCtx,
}: ResourceEditPageProps) {
  const reqCtx = providedReqCtx ?? (await buildRequestContext({ req, config }));
  checkRequireRole(resource.options.requireRole, reqCtx.role, reqCtx.session);
  await authorizeOperation(
    resolveOperationAccess(resource.options.access, resource.options.requireRole, "update"),
    reqCtx,
  );

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
  const action = `${config.paths.api}/${name}/${id}/edit`;
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
