import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import {
  assertResourceScope,
  authorizeOperation,
  mergeLabels,
  resolveOperationAccess,
} from "@flowpanel/core";
import { writeTarget } from "@flowpanel/core/internal";
import { AutoForm, PageHeader } from "@flowpanel/react";
import { writableColumns } from "../actions/field-pipeline";
import { buildApiHref, buildHref } from "../runtime/href";
import { buildRequestContext } from "../runtime/request-setup";
import {
  declaredFormFields,
  deniedFieldWrites,
  resolveFormFields,
} from "../runtime/resolve-form-fields";
import { singularTitle } from "../runtime/resource-title";

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
  await authorizeOperation(resolveOperationAccess(resource.options.access, "create"), reqCtx);
  assertResourceScope({
    hasGlobal: !!config.scope,
    resourceScope: resource.options.scope as "bypass" | ((...a: unknown[]) => unknown) | undefined,
  });

  const labels = mergeLabels(config.labels);
  if (resource.options.create?.disabled) {
    return <div className="text-fp-text-3">{labels.form.createDisabled}</div>;
  }

  const intro = config.adapter.introspect(writeTarget(resource));
  const action = buildApiHref(config, name, "create");
  const declared = declaredFormFields(resource, "create");
  const denied = await deniedFieldWrites(resource, reqCtx, null);
  const fields = declared
    ? await resolveFormFields(config, declared, reqCtx, undefined, denied)
    : undefined;

  return (
    <>
      <PageHeader title={singularTitle(labels.form.createTitle, resource, name)} />
      <div className="max-w-xl rounded-fp border border-fp-border-1 bg-fp-bg-1 p-6">
        <AutoForm
          action={action}
          columns={writableColumns(resource, intro.columns, declared)}
          hide={[...denied]}
          {...(fields ? { fields } : {})}
          submitLabel={labels.actions.create}
          cancelHref={buildHref(config, name)}
          redirectTo={buildHref(config, name)}
        />
      </div>
    </>
  );
}
