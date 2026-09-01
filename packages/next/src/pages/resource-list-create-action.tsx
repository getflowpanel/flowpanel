import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { CreateDrawer } from "@flowpanel/next/client";
import { AutoForm } from "@flowpanel/react";
import { buildHref } from "../runtime/href";
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

  return (
    <CreateDrawer label="Add new" title={`New ${label}`}>
      <AutoForm
        action={`${config.paths.api}/${name}/create`}
        columns={config.adapter.introspect(resource.ref).columns}
        {...(fields ? { fields } : {})}
        submitLabel="Create"
        redirectTo={buildHref(config, name)}
      />
    </CreateDrawer>
  );
}
