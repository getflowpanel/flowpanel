import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { assertResourceScope, mergeLabels, resolveOperationAccess } from "@flowpanel/core";
import { writeTarget } from "@flowpanel/core/internal";
import { AutoForm, PageHeader } from "@flowpanel/react";
import { createFormFields, writableColumns } from "../actions/field-pipeline";
import { buildApiHref, buildHref } from "../runtime/href";
import { buildRequestContext } from "../runtime/request-setup";
import { requireAccessIfSet } from "../runtime/require-access";
import {
  deniedFieldWrites,
  generatedColumnFields,
  hiddenFormFields,
  resolveFormFields,
  systemTimestamp,
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
  const declared = await createFormFields(config, resource, reqCtx);
  const offered = writableColumns(resource, intro.columns, declared).filter(
    (column) => declared || !systemTimestamp(column),
  );
  const denied = await deniedFieldWrites(resource, reqCtx, null);
  const fields = declared
    ? await resolveFormFields(
        config,
        declared,
        reqCtx,
        undefined,
        denied,
        await hiddenFormFields(resource, reqCtx, denied),
        intro.columns,
      )
    : undefined;

  return (
    <>
      <PageHeader
        title={singularTitle(labels.form.createTitle, resource, name, labels.dateRange.locale)}
      />
      <div className="fp-max-w-xl fp-rounded-lg fp-border fp-border-line fp-bg-surface fp-p-6 fp-shadow-xs">
        <AutoForm
          action={action}
          columns={offered}
          {...(declared
            ? {}
            : {
                columnFields: await generatedColumnFields(
                  config,
                  resource,
                  offered,
                  "create",
                  reqCtx,
                ),
              })}
          hide={[...denied]}
          {...(fields ? { fields } : {})}
          submitLabel={labels.actions.create}
          cancelHref={buildHref(config, name)}
          successMessage={singularTitle(
            labels.saving.created,
            resource,
            name,
            labels.dateRange.locale,
          )}
          redirectTo={buildHref(config, name)}
        />
      </div>
    </>
  );
}
