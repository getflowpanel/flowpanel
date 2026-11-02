import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { accessAllows, mergeLabels, resolveOperationAccess } from "@flowpanel/core";
import { writeTarget } from "@flowpanel/core/internal";
import { CreateDrawer } from "@flowpanel/next/client";
import { AutoForm } from "@flowpanel/react";
import { createFormFields, writableColumns } from "../actions/field-pipeline";
import { buildApiHref, buildHref } from "../runtime/href";
import {
  deniedFieldWrites,
  generatedColumnFields,
  hiddenFormFields,
  resolveFormFields,
  systemTimestamp,
} from "../runtime/resolve-form-fields";
import { singularTitle } from "../runtime/resource-title";

interface ResourceListCreateActionOptions {
  config: ResolvedAdminConfig;
  resource: ResourceConfig;
  name: string;
  reqCtx: RequestContext;
}

/** The New button's rule: create is on, the admin takes writes and the caller's role may create. */
export function mayCreate(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  reqCtx: RequestContext,
): Promise<boolean> {
  if (resource.options.create?.disabled || config.readOnly) return Promise.resolve(false);
  return accessAllows(resolveOperationAccess(resource.options.access, "create"), reqCtx);
}

export async function buildResourceListCreateAction({
  config,
  resource,
  name,
  reqCtx,
}: ResourceListCreateActionOptions) {
  if (!(await mayCreate(config, resource, reqCtx))) return undefined;

  const declared = await createFormFields(config, resource, reqCtx);
  const denied = await deniedFieldWrites(resource, reqCtx, null);
  const fields = declared
    ? await resolveFormFields(
        config,
        declared,
        reqCtx,
        undefined,
        denied,
        await hiddenFormFields(resource, reqCtx, denied),
        config.adapter.introspect(writeTarget(resource)).columns,
      )
    : undefined;
  const labels = mergeLabels(config.labels);
  const offered = writableColumns(
    resource,
    config.adapter.introspect(writeTarget(resource)).columns,
    declared,
  ).filter((column) => declared || !systemTimestamp(column));

  return (
    <CreateDrawer
      label={labels.actions.new}
      title={singularTitle(labels.form.createTitle, resource, name, labels.dateRange.locale)}
    >
      <AutoForm
        action={buildApiHref(config, name, "create")}
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
        successMessage={singularTitle(
          labels.saving.created,
          resource,
          name,
          labels.dateRange.locale,
        )}
        redirectTo={buildHref(config, name)}
      />
    </CreateDrawer>
  );
}
