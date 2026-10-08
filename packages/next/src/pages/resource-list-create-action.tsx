import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { mergeLabels } from "@flowpanel/core";
import { writeTarget } from "@flowpanel/core/internal";
import { CreateDrawer } from "@flowpanel/next/client";
import { AutoForm } from "@flowpanel/react";
import { writableColumns } from "../actions/field-pipeline";
import { buildApiHref, buildHref } from "../runtime/href";
import {
  declaredFormFields,
  deniedFieldWrites,
  hiddenFormFields,
  resolveFormFields,
} from "../runtime/resolve-form-fields";
import { singularTitle } from "../runtime/resource-title";

interface ResourceListCreateActionOptions {
  config: ResolvedAdminConfig;
  resource: ResourceConfig;
  name: string;
  reqCtx: RequestContext;
}

export async function buildResourceListCreateAction({
  config,
  resource,
  name,
  reqCtx,
}: ResourceListCreateActionOptions) {
  if (resource.options.create?.disabled) return undefined;

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
  const labels = mergeLabels(config.labels);

  return (
    <CreateDrawer
      label={labels.actions.new}
      title={singularTitle(labels.form.createTitle, resource, name)}
    >
      <AutoForm
        action={buildApiHref(config, name, "create")}
        columns={writableColumns(
          resource,
          config.adapter.introspect(writeTarget(resource)).columns,
          declared,
        )}
        hide={[...denied]}
        {...(fields ? { fields } : {})}
        submitLabel={labels.actions.create}
        redirectTo={buildHref(config, name)}
      />
    </CreateDrawer>
  );
}
