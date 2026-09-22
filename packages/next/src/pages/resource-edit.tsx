import type {
  ItemQueryContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import {
  assertResourceScope,
  authorizeOperation,
  checkRequireRole,
  filterReadableProjection,
  formatLabel,
  mergeLabels,
  resolveOperationAccess,
  runWithRequestContext,
} from "@flowpanel/core";
import { AutoForm, PageHeader } from "@flowpanel/react";
import { writableColumns } from "../actions/field-pipeline";
import { roleAllows } from "../runtime/action-helpers";
import { buildApiHref, buildHref } from "../runtime/href";
import { projectRowFields, selectKnownFields } from "../runtime/project-row";
import { buildRequestContext } from "../runtime/request-setup";
import { declaredFormFields, resolveFormFields } from "../runtime/resolve-form-fields";
import { singularLabel } from "../runtime/resource-title";
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

/**
 * The edit page's only row-read surface. Exposed values are dependencies for
 * dynamic form predicates; they are deliberately not form controls or defaults.
 */
function editProjectionCandidates(
  resource: ResourceConfig,
  fields: ReturnType<typeof declaredFormFields>,
  columns: ReadonlyArray<{
    name: string;
    primaryKey?: boolean;
    generated?: boolean;
    writableOnUpdate?: boolean;
  }>,
  reqCtx: RequestContext,
): string[] {
  const candidates = new Set<string>();
  const definitions = new Map((fields ?? []).map((field) => [field.name, field]));
  if (fields) {
    for (const field of fields) {
      if (roleAllows(field.requireRole, reqCtx)) candidates.add(field.name);
    }
  } else {
    for (const column of writableColumns(resource, [...columns], undefined, "update")) {
      candidates.add(column.name);
    }
  }
  for (const name of resource.options.update?.expose ?? []) {
    const definition = definitions.get(name);
    if (!definition || roleAllows(definition.requireRole, reqCtx)) candidates.add(name);
  }
  return [...candidates];
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
  assertResourceScope({
    hasGlobal: !!config.scope,
    resourceScope: resource.options.scope as "bypass" | ((...a: unknown[]) => unknown) | undefined,
  });

  if (resource.options.update?.disabled) {
    return <div className="text-fp-text-3">Editing is disabled for this resource.</div>;
  }

  const intro = config.adapter.introspect(resource.ref);
  const declared = declaredFormFields(resource, "update");
  const candidates = editProjectionCandidates(resource, declared, intro.columns, reqCtx);
  // Resolve policy before adapter work. The resulting selection and the local
  // projection below share this one decision even for dynamic policies.
  const readable = await filterReadableProjection(candidates, resource.options.fieldAccess, reqCtx);
  const select = selectKnownFields(readable, intro.columns);
  const ctx: ItemQueryContext = {
    ...reqCtx,
    db: config.adapter.db,
    dateRange: { from: new Date(0), to: new Date() },
    searchParams: new URLSearchParams(),
    signal: new AbortController().signal,
    id,
    select,
    ...scopeBinding(config, resource, reqCtx),
  };
  const row = (await runWithRequestContext(reqCtx, () =>
    config.adapter.get(resource.ref, ctx),
  )) as Record<string, unknown> | null;
  if (!row) return <NotFound />;

  const action = buildApiHref(config, name, id, "edit");
  const projectedValues = projectRowFields(row, select);
  const fields = declared
    ? await resolveFormFields(config, declared, reqCtx, projectedValues)
    : undefined;
  const columns = writableColumns(resource, intro.columns, declared, "update");
  const defaultFields = fields
    ? fields.map((field) => field.name)
    : columns.map((column) => column.name);
  const defaultValues = Object.fromEntries(
    defaultFields
      .filter((field) => readable.includes(field) && Object.hasOwn(projectedValues, field))
      .map((field) => [field, projectedValues[field]]),
  );

  const labels = mergeLabels(config.labels);
  return (
    <>
      <PageHeader
        title={formatLabel(labels.form.editTitle, { label: singularLabel(resource, name) })}
      />
      <div className="max-w-xl rounded-fp border border-fp-border-1 bg-fp-bg-1 p-6">
        <AutoForm
          action={action}
          columns={columns}
          defaultValues={defaultValues}
          {...(fields ? { fields } : {})}
          submitLabel={labels.actions.save}
          cancelHref={buildHref(config, name, id)}
          redirectTo={buildHref(config, name, id)}
        />
      </div>
    </>
  );
}
