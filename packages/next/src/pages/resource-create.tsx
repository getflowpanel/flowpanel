import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { assertResourceScope, mergeLabels, resolveOperationAccess } from "@flowpanel/core";
import { writeTarget } from "@flowpanel/core/internal";
import { AutoForm, PageHeader } from "@flowpanel/react";
import { writableColumns } from "../actions/field-pipeline";
import { buildApiHref, buildHref } from "../runtime/href";
import { buildRequestContext } from "../runtime/request-setup";
import { requireAccessIfSet } from "../runtime/require-access";
import {
  declaredFormFields,
  deniedFieldWrites,
  hiddenFormFields,
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
  await requireAccessIfSet(resolveOperationAccess(resource.options.access, "create"), reqCtx);
  assertResourceScope({
    hasGlobal: !!config.scope,
    resourceScope: resource.options.scope,
  });

  const labels = mergeLabels(config.labels);
  if (resource.options.create?.disabled) {
    return <div className="fp-text-faint">{labels.form.createDisabled}</div>;
  }

  const intro = config.adapter.introspect(writeTarget(resource));
  const action = buildApiHref(config, name, "create");
  const declared = declaredFormFields(resource, "create");
  const denied = await deniedFieldWrites(resource, reqCtx, null);
  const fields = declared
    ? await resolveFormFields(
        config,
        declared,
        reqCtx,
        undefined,
        denied,
        await hiddenFormFields(resource, reqCtx, denied),
      )
    : undefined;

  return (
    <>
      <PageHeader title={singularTitle(labels.form.createTitle, resource, name)} />
      <div className="fp-max-w-xl fp-rounded fp-border fp-border-line fp-bg-surface fp-p-6">
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
