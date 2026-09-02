"use client";
// LOC-OK: drawer shell — fields / resource / widgets / statgroup tab views plus the
// action bar and lazy tab loading in one client component.
import type { ColumnFormat } from "@flowpanel/core";
import {
  ConfirmDialog,
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  humanize,
  KV,
  KVRow,
  MetricCard,
  type NumericFormat,
  RealtimeRefresh,
  renderFormatCell,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type Tone,
  useAdminDrawer,
  useApiBase,
} from "@flowpanel/react";
import { Fragment, useEffect, useState } from "react";
import { ActionFormDialog } from "../actions/ActionFormDialog";
import type { ActionFormField, ActionFormFieldErrors } from "../actions/action-form-field";
import { useActionRunner } from "../actions/use-action-runner";
import { formatFieldValue } from "../runtime/format-field-value";
import { toWireOptions } from "../runtime/select-options";
import type { DrawerPayload, SerializedDrawerAction, SerializedDrawerTab } from "./drawer-route";

function toActionFormFields(form: SerializedDrawerAction["form"]): ActionFormField[] {
  if (!form) return [];
  return form.map((f) => ({
    name: f.name,
    ...(f.type ? { type: f.type } : {}),
    ...(f.options ? { options: toWireOptions(f.options) } : {}),
  }));
}

function resolveFieldEntries(
  row: Record<string, unknown>,
  fields: "*" | string[],
): [string, unknown][] {
  if (fields === "*") return Object.entries(row);
  return fields.map((k) => [k, row[k]]);
}

function FieldsView({
  row,
  fields,
  prerendered,
  labels,
  formats,
}: {
  row: Record<string, unknown>;
  fields: "*" | string[];
  prerendered: Record<string, string>;
  labels: Record<string, string>;
  formats: Record<string, ColumnFormat>;
}) {
  const entries = resolveFieldEntries(row, fields);
  return (
    <KV>
      {entries.map(([k, v]) => (
        <KVRow
          key={k}
          label={labels[k] ?? humanize(k)}
          value={
            prerendered[k] !== undefined ? (
              // biome-ignore lint/security/noDangerouslySetInnerHtml: server-prerendered from the resource's own column render
              <span dangerouslySetInnerHTML={{ __html: prerendered[k] }} />
            ) : formats[k] !== undefined ? (
              renderFormatCell(formats[k], v)
            ) : (
              formatFieldValue(v)
            )
          }
        />
      ))}
    </KV>
  );
}

function ResourceTabView({ tab }: { tab: Extract<SerializedDrawerTab, { kind: "resource" }> }) {
  if (tab.rows.length === 0) {
    return <div className="py-6 text-sm text-fp-text-3">No {tab.resource}.</div>;
  }
  const cols = tab.columns.length > 0 ? tab.columns : Object.keys(tab.rows[0] ?? {});
  return (
    <div className="overflow-hidden rounded-fp border border-fp-border-1 bg-fp-bg-1">
      <table className="w-full text-sm">
        <thead className="bg-fp-bg-2 text-fp-text-2 text-xs uppercase tracking-wide">
          <tr>
            {cols.map((c) => (
              <th key={c} scope="col" className="px-4 py-2 text-left font-medium">
                {humanize(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tab.rows.map((r, idx) => (
            <tr
              // biome-ignore lint/suspicious/noArrayIndexKey: drawer list has no stable row key at this layer and reorders only on refresh.
              key={idx}
              className="border-t border-fp-border-1 text-fp-text-1"
            >
              {cols.map((c) => (
                <td key={c} className="px-4 py-2">
                  {formatFieldValue(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WidgetTabView({ tab }: { tab: Extract<SerializedDrawerTab, { kind: "widgets" }> }) {
  if (tab.widgets.length === 0) {
    return <div className="py-6 text-sm text-fp-text-3">No widgets configured.</div>;
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {tab.widgets.map((w, i) => {
        const key = i;
        if (w.kind === "metric") {
          return (
            <Fragment key={key}>
              <MetricCard
                label={w.label}
                value={w.value}
                {...(w.format ? { format: w.format as NumericFormat } : {})}
                {...(w.sublabel ? { sublabel: w.sublabel } : {})}
                {...(w.tone ? { tone: w.tone as Tone } : {})}
              />
              {w.realtime ? <RealtimeRefresh channels={w.realtime} /> : null}
            </Fragment>
          );
        }
        if (w.kind === "table") {
          if (w.rows.length === 0) {
            return (
              <Fragment key={key}>
                <div className="py-6 text-sm text-fp-text-3 md:col-span-2">No data.</div>
                {w.realtime ? <RealtimeRefresh channels={w.realtime} /> : null}
              </Fragment>
            );
          }
          const cols: { field: string; label?: string }[] =
            w.columns.length > 0
              ? w.columns
              : Object.keys(w.rows[0] ?? {}).map((f) => ({ field: f }));
          return (
            <Fragment key={key}>
              <div className="overflow-hidden rounded-fp border border-fp-border-1 bg-fp-bg-1 md:col-span-2">
                {w.label ? (
                  <div className="border-b border-fp-border-1 bg-fp-bg-2 px-4 py-2 text-xs font-medium uppercase tracking-wide text-fp-text-2">
                    {w.label}
                  </div>
                ) : null}
                <table className="w-full text-sm">
                  <thead className="bg-fp-bg-2 text-fp-text-2 text-xs uppercase tracking-wide">
                    <tr>
                      {cols.map((c) => (
                        <th key={c.field} scope="col" className="px-4 py-2 text-left font-medium">
                          {c.label ?? humanize(c.field)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {w.rows.map((r, idx) => (
                      <tr
                        // biome-ignore lint/suspicious/noArrayIndexKey: server-resolved list without stable id
                        key={idx}
                        className="border-t border-fp-border-1 text-fp-text-1"
                      >
                        {cols.map((c) => (
                          <td key={c.field} className="px-4 py-2">
                            {formatFieldValue(r[c.field])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {w.realtime ? <RealtimeRefresh channels={w.realtime} /> : null}
            </Fragment>
          );
        }
        if (w.kind === "statGroup") {
          return (
            <Fragment key={key}>
              <div className="rounded-fp border border-fp-border-1 bg-fp-bg-1 p-4 md:col-span-2">
                {w.label ? (
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-fp-text-2">
                    {w.label}
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {w.stats.map((s, j) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: stable order inside widget
                    <div key={j}>
                      <div className="text-xs text-fp-text-3">{s.label}</div>
                      <div className="text-lg font-semibold text-fp-text-1 tabular-nums">
                        {formatFieldValue(s.value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {w.realtime ? <RealtimeRefresh channels={w.realtime} /> : null}
            </Fragment>
          );
        }
        if (w.kind === "chart") {
          return (
            <Fragment key={key}>
              <div className="rounded-fp border border-fp-border-1 bg-fp-bg-2 p-4 text-sm text-fp-text-3 md:col-span-2">
                <div className="font-medium text-fp-text-2">{w.label}</div>
                <div className="mt-1 text-xs">
                  Chart visualization lives on dashboards. Data points: {w.dataPoints}.
                </div>
              </div>
              {w.realtime ? <RealtimeRefresh channels={w.realtime} /> : null}
            </Fragment>
          );
        }
        return (
          <div
            key={key}
            className="rounded-fp border border-fp-border-1 bg-fp-bg-2 p-4 text-sm text-fp-text-3 md:col-span-2"
          >
            {w.reason}
          </div>
        );
      })}
    </div>
  );
}

function DrawerBody({ payload }: { payload: DrawerPayload }) {
  const { state, open } = useAdminDrawer();
  const tabs = payload.tabs;
  if (!tabs || tabs.length === 0) {
    return (
      <FieldsView
        row={payload.row}
        fields={payload.fields}
        prerendered={payload.prerendered}
        labels={payload.labels}
        formats={payload.formats}
      />
    );
  }
  const firstKey = tabs[0]?.key ?? "";
  const activeTab = state.tab ?? firstKey;
  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => {
        if (state.resource && state.id) {
          open({ resource: state.resource, id: state.id, tab: v });
        }
      }}
    >
      <TabsList>
        {tabs.map((t) => (
          <TabsTrigger key={t.key} value={t.key}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.key} value={t.key} className="mt-4">
          {t.kind === "fields" ? (
            <FieldsView
              row={payload.row}
              fields={t.fields}
              prerendered={payload.prerendered}
              labels={payload.labels}
              formats={payload.formats}
            />
          ) : t.kind === "resource" ? (
            <ResourceTabView tab={t} />
          ) : t.kind === "widgets" ? (
            <WidgetTabView tab={t} />
          ) : (
            <div className="rounded-fp-sm border border-fp-border-1 bg-fp-bg-2 p-3 text-sm text-fp-text-3">
              Unsupported tab kind.
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function ActionButton({
  action,
  resource,
  id,
  onActionSuccess,
}: {
  action: SerializedDrawerAction;
  resource: string;
  id: string;
  onActionSuccess: () => void;
}) {
  const apiBase = useApiBase();
  const runAction = useActionRunner();
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const hasForm = Boolean(action.form && action.form.length > 0);

  async function runDrawerAction(
    input: Record<string, unknown> = {},
  ): Promise<ActionFormFieldErrors | null> {
    setPending(true);
    try {
      return await runAction(
        `${apiBase}/drawer/${encodeURIComponent(resource)}/${encodeURIComponent(id)}/actions/${encodeURIComponent(action.key)}`,
        input,
        { failureMessage: `${action.label} failed`, onRefreshed: onActionSuccess },
      );
    } finally {
      setPending(false);
    }
  }

  function onClick() {
    if (hasForm) {
      setFormOpen(true);
    } else if (action.confirm) {
      setConfirmOpen(true);
    } else {
      void runDrawerAction();
    }
  }

  const variantClass =
    action.variant === "destructive"
      ? "bg-fp-err text-fp-accent-text hover:bg-fp-err/90"
      : "bg-fp-accent text-fp-accent-text hover:bg-fp-accent/90";

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={`inline-flex h-9 items-center rounded-fp-sm px-3 text-sm font-medium transition-colors disabled:opacity-50 ${variantClass}`}
      >
        {pending ? "…" : action.label}
      </button>
      {formOpen ? (
        <ActionFormDialog
          title={action.confirm ?? action.label}
          submitLabel={action.label}
          {...(action.variant === "destructive" ? { variant: "destructive" as const } : {})}
          fields={toActionFormFields(action.form)}
          onCancel={() => setFormOpen(false)}
          onSubmit={async (input) => {
            const fieldErrors = await runDrawerAction(input);
            if (!fieldErrors) setFormOpen(false);
            return fieldErrors;
          }}
        />
      ) : null}
      {!hasForm && action.confirm ? (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={action.confirm}
          confirmLabel={action.label}
          {...(action.variant === "destructive" ? { variant: "destructive" as const } : {})}
          onConfirm={() => {
            void runDrawerAction();
          }}
        />
      ) : null}
    </>
  );
}

export function DrawerHost() {
  const { state, close } = useAdminDrawer();
  const apiBase = useApiBase();
  const [payload, setPayload] = useState<DrawerPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const { resource, id } = state;
  const open = Boolean(resource && id);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey intentionally forces re-fetch on reload
  useEffect(() => {
    if (!resource || !id) {
      setPayload(null);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`${apiBase}/drawer/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`, {
      signal: ctrl.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({ error: res.statusText }))) as {
            error?: string;
          };
          throw new Error(body.error ?? `error ${res.status}`);
        }
        return (await res.json()) as DrawerPayload;
      })
      .then((data) => {
        setPayload(data);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "failed to load");
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [resource, id, reloadKey]);

  const width = payload?.width ?? "lg";
  const title = payload?.header ?? "";

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
      }}
      width={width}
      title={title || "Drawer"}
    >
      <DrawerHeader>
        <div className="min-w-0 pr-10">
          <h2 className="truncate text-lg font-semibold text-fp-text-1">{title || "Loading…"}</h2>
          {resource && id ? (
            <p className="text-xs text-fp-text-3">
              {payload?.resourceLabel ?? humanize(resource)} · {id}
            </p>
          ) : null}
        </div>
      </DrawerHeader>
      <DrawerContent>
        {loading ? <div className="text-sm text-fp-text-3">Loading…</div> : null}
        {error ? (
          <div className="rounded-fp-sm border border-fp-err/40 bg-fp-err/10 p-3 text-sm text-fp-err">
            {error}
          </div>
        ) : null}
        {payload ? <DrawerBody payload={payload} /> : null}
      </DrawerContent>
      {payload && payload.actions.length > 0 && resource && id ? (
        <DrawerFooter>
          {payload.actions.map((a) => (
            <ActionButton
              key={a.key}
              action={a}
              resource={resource}
              id={id}
              onActionSuccess={() => setReloadKey((k) => k + 1)}
            />
          ))}
        </DrawerFooter>
      ) : null}
    </Drawer>
  );
}
