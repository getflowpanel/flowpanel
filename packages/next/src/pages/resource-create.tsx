import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import {
  assertResourceScope,
  authorizeOperation,
  checkRequireRole,
  formatLabel,
  mergeLabels,
  resolveOperationAccess,
} from "@flowpanel/core";
import { AutoForm, PageHeader } from "@flowpanel/react";
import { writableColumns } from "../actions/field-pipeline";
import { buildApiHref, buildHref } from "../runtime/href";
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
  assertResourceScope({
    hasGlobal: !!config.scope,
    resourceScope: resource.options.scope as "bypass" | ((...a: unknown[]) => unknown) | undefined,
  });

  if (resource.options.create?.disabled) {
    return <div className="text-fp-text-3">Create is disabled for this resource.</div>;
  }

  const intro = config.adapter.introspect(resource.ref);
  const action = buildApiHref(config, name, "create");
  const declared = declaredFormFields(resource, "create");
  const fields = declared ? await resolveFormFields(config, declared, reqCtx) : undefined;

  const labels = mergeLabels(config.labels);
  return (
    <>
      <PageHeader
        title={formatLabel(labels.form.createTitle, { label: singularLabel(resource, name) })}
      />
      <div className="max-w-xl rounded-fp border border-fp-border-1 bg-fp-bg-1 p-6">
        <AutoForm
          action={action}
          columns={writableColumns(resource, intro.columns, declared)}
          {...(fields ? { fields } : {})}
          submitLabel={labels.actions.create}
          cancelHref={buildHref(config, name)}
          redirectTo={buildHref(config, name)}
        />
      </div>
    </>
  );
}
