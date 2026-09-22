import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { formatLabel, mergeLabels } from "@flowpanel/core";
import { CreateDrawer } from "@flowpanel/next/client";
import { AutoForm } from "@flowpanel/react";
import { writableColumns } from "../actions/field-pipeline";
import { buildApiHref, buildHref } from "../runtime/href";
import { declaredFormFields, resolveFormFields } from "../runtime/resolve-form-fields";
import { singularLabel } from "../runtime/resource-title";

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
  const fields = declared ? await resolveFormFields(config, declared, reqCtx) : undefined;
  const label = singularLabel(resource, name);
  const labels = mergeLabels(config.labels);

  return (
    <CreateDrawer
      label={labels.actions.new}
      title={formatLabel(labels.form.createTitle, { label })}
    >
      <AutoForm
        action={buildApiHref(config, name, "create")}
        columns={writableColumns(
          resource,
          config.adapter.introspect(resource.ref).columns,
          declared,
        )}
        {...(fields ? { fields } : {})}
        submitLabel={labels.actions.create}
        redirectTo={buildHref(config, name)}
      />
    </CreateDrawer>
  );
}
