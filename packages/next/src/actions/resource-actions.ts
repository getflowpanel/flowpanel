import type {
  MutationContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import {
  FlowpanelNotFoundError,
  FlowpanelOperationDisabledError,
  mergeLabels,
  resolveFormatting,
  resolveOperationAccess,
  runWithRequestContext,
} from "@flowpanel/core";
import { writeTarget } from "@flowpanel/core/internal";
import { changesRow } from "../runtime/action-helpers";
import { buildServerRequest } from "../runtime/build-server-request";
import { explainWrite } from "../runtime/constraint-error";
import { deleteRow } from "../runtime/delete-row";
import { keepUntouchedTimes } from "../runtime/form-dates";
import { buildHref } from "../runtime/href";
import { keepUntouchedMoney, moneyShapes } from "../runtime/money-field";
import { resourceNavName } from "../runtime/nav";
import { bindPublisher } from "../runtime/publish";
import { readLiveRow, readRow } from "../runtime/read-row";
import { buildRequestContext } from "../runtime/request-setup";
import { requireAccessIfSet } from "../runtime/require-access";
import { requireAuthorized } from "../runtime/require-authorized";
import { declaredFormFields, deniedFieldWrites } from "../runtime/resolve-form-fields";
import { rowKeyOf } from "../runtime/row-identity";
import { scopeBinding } from "../runtime/scope-binding";
import { auditDiff, commitEffects, type WriteEffects } from "../runtime/write-pipeline";
import {
  applyFieldDefaults,
  assertResourceWritableInput,
  editableColumns,
  formInput,
  pickSchema,
  schemasFor,
  updateFields,
} from "./field-pipeline";
import { checkedValues } from "./field-validation";

export interface CreateOptions {
  /** Fields the form or file decoding refused, reported with every other field error. */
  decodeErrors?: Readonly<Record<string, string>>;
}

export interface UpdateOptions extends CreateOptions {
  /** An inline edit of this one column: it need not be a form field, and only it is validated. */
  inline?: string;
}

export interface ResourceActions {
  create: (input: unknown, options?: CreateOptions) => Promise<unknown>;
  update: (id: string, input: unknown, options?: UpdateOptions) => Promise<unknown>;
  delete: (id: string) => Promise<void>;
}

export interface MakeActionsOptions {
  /** Reuse a caller-built `RequestContext` instead of building one per call. */
  reqCtx?: RequestContext;
  /** Publish + revalidate per call. Default `true`; set `false` to batch-notify once yourself. */
  publish?: boolean;
  /** The input is a posted form, which also carries the fields it showed read-only. */
  fromForm?: boolean;
}

function dateColumnsOf(config: ResolvedAdminConfig, resource: ResourceConfig): Set<string> {
  const { columns } = config.adapter.introspect(writeTarget(resource));
  return new Set(columns.filter((c) => c.type === "date").map((c) => c.name));
}

/**
 * The guarded write path behind every create, update and delete: access, `readOnly`, disabled
 * operations, field rules, the scoped write, one audit event and the realtime publish.
 */
export function makeActions(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  opts: MakeActionsOptions = {},
): ResourceActions {
  bindPublisher(config);
  const name = resourceNavName(resource);
  const schemas = schemasFor(config, resource);
  const labels = mergeLabels(config.labels);

  async function ctxFor(path: string): Promise<RequestContext> {
    if (opts.reqCtx) return opts.reqCtx;
    return buildRequestContext({
      req: await buildServerRequest(`http://localhost${path}`),
      config,
    });
  }

  async function guard(
    reqCtx: RequestContext,
    operation: "create" | "update" | "delete",
  ): Promise<void> {
    requireAuthorized(config, resource);
    await requireAccessIfSet(resolveOperationAccess(resource.options.access, operation), reqCtx);
    if (config.readOnly) throw new FlowpanelOperationDisabledError("This admin is read-only.");
    if (resource.options[operation]?.disabled) {
      throw new FlowpanelOperationDisabledError(DISABLED[operation]);
    }
  }

  async function commit(
    reqCtx: RequestContext,
    change: { action: "create" | "update" | "delete"; id?: string },
    audit: WriteEffects["audit"],
    paths: string[],
  ): Promise<void> {
    await commitEffects(
      config,
      reqCtx,
      { ok: true },
      {
        audit: { ...audit, resource: name },
        resourceAudit: resource.options.audit,
        publish: opts.publish === false ? {} : { resourceName: name, change, pathname: paths },
      },
    );
  }

  return {
    async create(input, options = {}) {
      const reqCtx = await ctxFor(buildHref(config, name, "new"));
      await guard(reqCtx, "create");

      const fields = declaredFormFields(resource, "create");
      const denied = await deniedFieldWrites(resource, reqCtx, null);
      const submitted = opts.fromForm ? formInput(fields, input, null, denied) : input;
      const safe = await assertResourceWritableInput(resource, fields, submitted, null, reqCtx);
      const withDefaults = await applyFieldDefaults(resource, fields, safe, reqCtx);
      const values = await checkedValues(
        config,
        resource,
        labels,
        schemas.create,
        fields,
        withDefaults,
        null,
        reqCtx,
        denied,
        options.decodeErrors,
      );

      const mctx: MutationContext<Record<string, unknown>> = {
        ...reqCtx,
        db: config.adapter.db,
        input: values,
        ...scopeBinding(resource, reqCtx),
      };
      const row = (await explainWrite(config, resource, "create", () =>
        runWithRequestContext(reqCtx, () => config.adapter.create(writeTarget(resource), mctx)),
      )) as Record<string, unknown> | null | undefined;
      const rowId = row && typeof row === "object" ? row[rowKeyOf(resource)] : undefined;
      const id = rowId !== undefined && rowId !== null ? String(rowId) : undefined;
      await commit(
        reqCtx,
        { action: "create", ...(id !== undefined ? { id } : {}) },
        {
          action: `${name}.create`,
          ...(id !== undefined ? { targetId: id } : {}),
          ...(id !== undefined && row ? { rows: new Map([[id, row]]) } : {}),
          diff: () => auditDiff(config, resource, null, row ?? values, reqCtx, Object.keys(values)),
        },
        [buildHref(config, name)],
      );
      return row;
    },

    async update(id, input, options = {}) {
      const reqCtx = await ctxFor(buildHref(config, name, id, "edit"));
      await guard(reqCtx, "update");

      const fields = updateFields(
        resource,
        options.inline !== undefined
          ? [options.inline]
          : opts.fromForm
            ? []
            : editableColumns(resource),
      );
      const current = await readLiveRow(config, resource, id, reqCtx);
      if (!current) throw new FlowpanelNotFoundError();
      const denied = await deniedFieldWrites(resource, reqCtx, current);
      const submitted = opts.fromForm
        ? keepUntouchedMoney(
            keepUntouchedTimes(
              formInput(fields, input, current, denied),
              current,
              dateColumnsOf(config, resource),
            ),
            current,
            moneyShapes(
              fields,
              config.adapter.introspect(writeTarget(resource)).columns,
              resolveFormatting(config.formatting),
            ),
          )
        : input;
      const safe = await assertResourceWritableInput(resource, fields, submitted, current, reqCtx);
      const schema =
        options.inline === undefined ? schemas.update : pickSchema(schemas.update, options.inline);
      const values = await checkedValues(
        config,
        resource,
        labels,
        schema,
        fields,
        safe,
        current,
        reqCtx,
        denied,
        options.decodeErrors,
      );

      const mctx: MutationContext<Record<string, unknown>> = {
        ...reqCtx,
        db: config.adapter.db,
        input: values,
        id,
        ...scopeBinding(resource, reqCtx),
      };
      const written = await explainWrite(config, resource, "update", () =>
        runWithRequestContext(reqCtx, () => config.adapter.update(writeTarget(resource), mctx)),
      );
      if (!written) throw new FlowpanelNotFoundError();
      const row =
        resource.options.writeTo === undefined
          ? written
          : ((await readRow(config, resource, id, reqCtx)) ?? written);
      await commit(
        reqCtx,
        { action: "update", id },
        {
          action: options.inline === undefined ? `${name}.update` : `${name}.inline-update`,
          targetId: id,
          rows: new Map([[id, current]]),
          ...(changesRow(current, values) ? {} : { unchanged: true }),
          diff: () =>
            auditDiff(
              config,
              resource,
              current,
              { ...current, ...values },
              reqCtx,
              Object.keys(values),
            ),
        },
        [buildHref(config, name), buildHref(config, name, id)],
      );
      return row;
    },

    async delete(id) {
      const reqCtx = await ctxFor(buildHref(config, name, id));
      await guard(reqCtx, "delete");

      const current = await readLiveRow(config, resource, id, reqCtx);
      if (!current) throw new FlowpanelNotFoundError();

      await deleteRow(config, resource, id, reqCtx);
      await commit(
        reqCtx,
        { action: "delete", id },
        {
          action: `${name}.delete`,
          targetId: id,
          diff: () => auditDiff(config, resource, current, null, reqCtx),
          rows: new Map([[id, current]]),
        },
        [buildHref(config, name)],
      );
    },
  };
}

const DISABLED = {
  create: "Create is disabled for this resource.",
  update: "Update is disabled for this resource.",
  delete: "Delete is disabled for this resource.",
} as const;

export interface FormActionResult {
  ok: boolean;
  /** Stable row key returned by create routes so the destination list can animate that row. */
  createdKey?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}
