import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { authorizeOperation, checkRequireRole, resolveOperationAccess } from "@flowpanel/core";
import { AutoForm, PageHeader } from "@flowpanel/react";
import { writableColumns } from "../actions/field-pipeline";
import { buildHref } from "../runtime/href";
import { buildRequestContext } from "../runtime/request-setup";
import { declaredFormFields, resolveFormFields } from "../runtime/resolve-form-fields";
import { singularLabel } from "../runtime/resource-title";

export interface ResourceCreatePageProps {
  config: ResolvedAdminConfig;
  resource: ResourceConfig;
  name: string;
  req: Request;
  reqCtx?: RequestContext;
}

export async function ResourceCreatePage({
  config,
  resource,
  name,
  req,
  reqCtx: providedReqCtx,
}: ResourceCreatePageProps) {
  const reqCtx = providedReqCtx ?? (await buildRequestContext({ req, config }));
  checkRequireRole(resource.options.requireRole, reqCtx.role, reqCtx.session);
  await authorizeOperation(
    resolveOperationAccess(resource.options.access, resource.options.requireRole, "create"),
    reqCtx,
  );

  if (resource.options.create?.disabled) {
    return <div className="text-fp-text-3">Create is disabled for this resource.</div>;
  }

  const intro = config.adapter.introspect(resource.ref);
  const action = `${config.paths.api}/${name}/create`;
  const declared = declaredFormFields(resource, "create");
  const fields = declared ? await resolveFormFields(config, declared, reqCtx) : undefined;

  return (
    <>
      <PageHeader title={`New ${singularLabel(resource, name)}`} />
      <div className="max-w-xl rounded-fp border border-fp-border-1 bg-fp-bg-1 p-6">
        <AutoForm
          action={action}
          columns={writableColumns(resource, intro.columns, declared)}
          {...(fields ? { fields } : {})}
          submitLabel="Create"
          redirectTo={buildHref(config, name)}
        />
      </div>
    </>
  );
}
