import type {
  ItemQueryContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import {
  assertResourceScope,
  authorizeOperation,
  filterReadableProjection,
  mergeLabels,
  resolveFormatting,
  resolveOperationAccess,
  runWithRequestContext,
} from "@flowpanel/core";
import { writeTarget } from "@flowpanel/core/internal";
import { AutoForm, PageHeader } from "@flowpanel/react";
import { notFound } from "next/navigation";
import { writableColumns } from "../actions/field-pipeline";
import { roleAllows } from "../runtime/action-helpers";
import { dateInputFor, dateInputValue } from "../runtime/form-dates";
import { buildApiHref, buildHref } from "../runtime/href";
import { projectRowFields, selectKnownFields } from "../runtime/project-row";
import { buildRequestContext } from "../runtime/request-setup";
import {
  declaredFormFields,
  deniedFieldWrites,
  resolveFormFields,
} from "../runtime/resolve-form-fields";
import { singularTitle } from "../runtime/resource-title";
import { scopeBinding } from "../runtime/scope-binding";

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
  await authorizeOperation(resolveOperationAccess(resource.options.access, "update"), reqCtx);
  assertResourceScope({
    hasGlobal: !!config.scope,
    resourceScope: resource.options.scope as "bypass" | ((...a: unknown[]) => unknown) | undefined,
  });

  const labels = mergeLabels(config.labels);
  if (resource.options.update?.disabled) {
    return <div className="text-fp-text-3">{labels.form.editDisabled}</div>;
  }

  const intro = config.adapter.introspect(resource.ref);
  const written =
    resource.options.writeTo === undefined
      ? intro
      : config.adapter.introspect(writeTarget(resource));
  const declared = declaredFormFields(resource, "update");
  const candidates = editProjectionCandidates(resource, declared, written.columns, reqCtx);
  // Resolved once so the selection and the local projection below share this decision even for dynamic policies.
  const readable = await filterReadableProjection(candidates, resource.options.fieldAccess, reqCtx);
  const select = selectKnownFields(readable, intro.columns);
  const ctx: ItemQueryContext = {
    ...reqCtx,
    dateRange: { from: new Date(0), to: new Date() },
    searchParams: new URLSearchParams(),
    signal: new AbortController().signal,
    id,
    select,
    ...scopeBinding(resource, reqCtx),
  };
  const row = (await runWithRequestContext(reqCtx, () =>
    config.adapter.get(resource.ref, ctx),
  )) as Record<string, unknown> | null;
  if (!row) notFound();

  const action = buildApiHref(config, name, id, "edit");
  const projectedValues = projectRowFields(row, select);
  const denied = await deniedFieldWrites(resource, reqCtx, projectedValues);
  const fields = declared
    ? await resolveFormFields(config, declared, reqCtx, projectedValues, denied)
    : undefined;
  const columns = writableColumns(resource, written.columns, declared, "update");
  const defaultFields = fields
    ? fields.map((field) => field.name)
    : columns.map((column) => column.name);
  const { timeZone } = resolveFormatting(config.formatting);
  const columnTypes = new Map(written.columns.map((column) => [column.name, column.type]));
  const declaredByName = new Map(declared?.map((field) => [field.name, field]));
  const defaultValues = Object.fromEntries(
    defaultFields
      .filter((field) => readable.includes(field) && Object.hasOwn(projectedValues, field))
      .map((field) => {
        const value = projectedValues[field];
        const input = dateInputFor(
          declared ? (declaredByName.get(field) ?? {}) : undefined,
          columnTypes.get(field),
        );
        return [field, input ? dateInputValue(value, input, timeZone) : value];
      }),
  );

  return (
    <>
      <PageHeader title={singularTitle(labels.form.editTitle, resource, name)} />
      <div className="max-w-xl rounded-fp border border-fp-border-1 bg-fp-bg-1 p-6">
        <AutoForm
          action={action}
          columns={columns}
          defaultValues={defaultValues}
          hide={[...denied]}
          {...(fields ? { fields } : {})}
          submitLabel={labels.actions.save}
          cancelHref={buildHref(config, name, id)}
          redirectTo={buildHref(config, name, id)}
        />
      </div>
    </>
  );
}
