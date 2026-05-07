"use client";
import {
  ConfirmDialog,
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  KV,
  KVRow,
  MetricCard,
  type NumericFormat,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type Tone,
  triggerDownload,
  useAdminDrawer,
  useToast,
} from "@flowpanel/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { DrawerPayload, SerializedDrawerAction, SerializedDrawerTab } from "./drawer-route.js";

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function resolveFieldEntries(
  row: Record<string, unknown>,
  fields: "*" | string[],
): [string, unknown][] {
  if (fields === "*") return Object.entries(row);
  return fields.map((k) => [k, row[k]]);
}

function FieldsView({ row, fields }: { row: Record<string, unknown>; fields: "*" | string[] }) {
  const entries = resolveFieldEntries(row, fields);
  return (
    <KV>
      {entries.map(([k, v]) => (
        <KVRow key={k} label={k} value={formatValue(v)} />
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
                {c}
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
                  {formatValue(r[c])}
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
        // biome-ignore lint/suspicious/noArrayIndexKey: stable order in server-resolved payload
        const key = i;
        if (w.kind === "metric") {
          return (
            <MetricCard
              key={key}
              label={w.label}
              value={w.value}
              {...(w.format ? { format: w.format as NumericFormat } : {})}
              {...(w.sublabel ? { sublabel: w.sublabel } : {})}
              {...(w.tone ? { tone: w.tone as Tone } : {})}
            />
          );
        }
        if (w.kind === "table") {
          if (w.rows.length === 0) {
            return (
              <div key={key} className="py-6 text-sm text-fp-text-3 md:col-span-2">
                No data.
              </div>
            );
          }
          const cols = w.columns.length > 0 ? w.columns : Object.keys(w.rows[0] ?? {});
          return (
            <div
              key={key}
              className="overflow-hidden rounded-fp border border-fp-border-1 bg-fp-bg-1 md:col-span-2"
            >
              {w.label ? (
                <div className="border-b border-fp-border-1 bg-fp-bg-2 px-4 py-2 text-xs font-medium uppercase tracking-wide text-fp-text-2">
                  {w.label}
                </div>
              ) : null}
              <table className="w-full text-sm">
                <thead className="bg-fp-bg-2 text-fp-text-2 text-xs uppercase tracking-wide">
                  <tr>
                    {cols.map((c) => (
                      <th key={c} scope="col" className="px-4 py-2 text-left font-medium">
                        {c}
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
                        <td key={c} className="px-4 py-2">
                          {formatValue(r[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (w.kind === "statGroup") {
          return (
            <div
              key={key}
              className="rounded-fp border border-fp-border-1 bg-fp-bg-1 p-4 md:col-span-2"
            >
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
                      {formatValue(s.value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        if (w.kind === "chart") {
          return (
            <div
              key={key}
              className="rounded-fp border border-fp-border-1 bg-fp-bg-2 p-4 text-sm text-fp-text-3 md:col-span-2"
            >
              <div className="font-medium text-fp-text-2">{w.label}</div>
              <div className="mt-1 text-xs">
                Chart visualization lives on dashboards. Data points: {w.dataPoints}.
              </div>
            </div>
          );
        }
        // unsupported
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
    return <FieldsView row={payload.row} fields={payload.fields} />;
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
            <FieldsView row={payload.row} fields={t.fields} />
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

interface DrawerActionResult {
  ok: boolean;
  message?: string;
  error?: string;
  refresh?: boolean | string | string[];
  redirect?: string;
  download?: { filename: string; data: string; mime?: string };
}

function ActionButton({
  action,
  resource,
  id,
}: {
  action: SerializedDrawerAction;
  resource: string;
  id: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function runAction() {
    setPending(true);
    try {
      const res = await fetch(
        `/api/flowpanel/drawer/${encodeURIComponent(resource)}/${encodeURIComponent(
          id,
        )}/actions/${encodeURIComponent(action.key)}`,
        { method: "POST" },
      );
      const result = (await res.json().catch(() => ({
        ok: false,
        error: res.statusText,
      }))) as DrawerActionResult;
      if (!res.ok || result.ok === false) {
        toast.error(result.error ?? `Error ${res.status}`);
        return;
      }
      if (result.message) toast.success(result.message);
      if (result.download) triggerDownload(result.download);
      if (result.redirect) {
        router.push(result.redirect);
      } else if (result.refresh !== false) {
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setPending(false);
    }
  }

  function onClick() {
    if (action.confirm) {
      setConfirmOpen(true);
    } else {
      void runAction();
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
      {action.confirm ? (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={action.confirm}
          confirmLabel={action.label}
          {...(action.variant === "destructive" ? { variant: "destructive" as const } : {})}
          onConfirm={runAction}
        />
      ) : null}
    </>
  );
}

export function DrawerHost() {
  const { state, close } = useAdminDrawer();
  const [payload, setPayload] = useState<DrawerPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { resource, id } = state;
  const open = Boolean(resource && id);

  useEffect(() => {
    if (!resource || !id) {
      setPayload(null);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/flowpanel/drawer/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`, {
      signal: ctrl.signal,
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
  }, [resource, id]);

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
              {resource} · {id}
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
            <ActionButton key={a.key} action={a} resource={resource} id={id} />
          ))}
        </DrawerFooter>
      ) : null}
    </Drawer>
  );
}
