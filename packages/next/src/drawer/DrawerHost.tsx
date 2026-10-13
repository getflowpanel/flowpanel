"use client";
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  HealthBanner,
  humanize,
  Skeleton,
  useAdminDrawer,
  useApiBase,
  useLabels,
} from "@flowpanel/react";
import { useEffect, useRef, useState } from "react";
import { RecordActionsBar } from "../actions/RecordActionsBar";
import { RestoreButton } from "../actions/RestoreButton";
import { readActionFailure } from "../actions/read-action-failure";
import { DrawerBody } from "./DrawerBody";
import type { DrawerPayload } from "./drawer-route";

/** What was fetched, and for which record: a payload never shows under another record's URL. */
type Loaded =
  | { key: string; resource: string; payload: DrawerPayload }
  | { key: string; resource: string; error: string };

function recordKey(resource: string | null, id: string | null): string | null {
  return resource && id ? JSON.stringify([resource, id]) : null;
}

function LoadingBody({ label }: { label: string }) {
  return (
    <div role="status" className="fp-space-y-3">
      <span className="fp-sr-only">{label}</span>
      {[0, 1, 2, 3].map((line) => (
        <div key={line} className="fp-flex fp-items-center fp-gap-4" aria-hidden>
          <Skeleton className="fp-h-4 fp-w-24" />
          <Skeleton className="fp-h-4 fp-flex-1" />
        </div>
      ))}
    </div>
  );
}

/** The URL-driven record drawer: loads the record the URL names and owns its header, actions and body. */
export function DrawerHost() {
  const { state, close } = useAdminDrawer();
  const apiBase = useApiBase();
  const labels = useLabels();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const { resource, id } = state;
  const key = recordKey(resource, id);
  const current = loaded && loaded.key === key ? loaded : null;
  const payload = current && "payload" in current ? current.payload : null;
  const error = current && "error" in current ? current.error : null;
  // The URL no longer names the row by the time the drawer gives focus back.
  const lastRow = useRef<{ resource: string; id: string } | null>(null);
  if (resource && id) lastRow.current = { resource, id };

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey re-fetches the same record after an action.
  useEffect(() => {
    if (!resource || !id || key === null) return;
    const ctrl = new AbortController();
    const url = `${apiBase}/drawer/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`;
    fetch(url, { signal: ctrl.signal, cache: "no-store" })
      .then(async (res) => {
        if (res.status === 404) throw new Error(labels.drawer.missing);
        if (!res.ok) {
          const body: unknown = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(readActionFailure(body).message ?? labels.drawer.loadFailed);
        }
        return (await res.json()) as DrawerPayload;
      })
      .then((data) => setLoaded({ key, resource, payload: data }))
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === "AbortError") return;
        setLoaded({
          key,
          resource,
          error: e instanceof Error ? e.message : labels.drawer.loadFailed,
        });
      });
    return () => ctrl.abort();
  }, [key, reloadKey]);

  const previous =
    loaded && "payload" in loaded && loaded.resource === resource ? loaded.payload : null;
  const width = payload?.width ?? previous?.width ?? "lg";
  const reload = () => setReloadKey((k) => k + 1);

  return (
    <Drawer
      open={key !== null}
      onOpenChange={(v) => {
        if (!v) close();
      }}
      width={width}
      returnFocus={() => {
        const row = lastRow.current;
        if (row === null) return null;
        return document.querySelector<HTMLElement>(
          `[data-fp-resource="${CSS.escape(row.resource)}"] [data-fp-row-key="${CSS.escape(row.id)}"]`,
        );
      }}
    >
      <DrawerHeader className="fp-flex-col fp-gap-3 fp-pr-14 sm:fp-flex-row sm:fp-items-start">
        <div className="fp-min-w-0 fp-max-w-full sm:fp-flex-1">
          <DrawerTitle>
            {payload ? (
              payload.title || labels.drawer.title
            ) : error ? (
              humanize(resource ?? "")
            ) : (
              <>
                <span className="fp-sr-only">{labels.drawer.title}</span>
                <Skeleton className="fp-my-1 fp-h-5 fp-w-48" aria-hidden />
              </>
            )}
          </DrawerTitle>
          {resource && !error ? (
            <p className="fp-text-xs fp-text-faint">
              {payload ? (payload.subtitle ?? payload.resourceLabel) : humanize(resource)}
            </p>
          ) : null}
        </div>
        {payload && resource && id ? (
          <div className="fp-flex fp-shrink-0 fp-flex-wrap fp-items-center fp-gap-2 sm:-fp-mt-0.5">
            {payload.detailHref ? (
              <Button asChild variant="outline" size="sm">
                <a href={payload.detailHref}>{labels.drawer.viewDetails}</a>
              </Button>
            ) : null}
            <RecordActionsBar
              key={key}
              resource={resource}
              id={id}
              rowActions={payload.rowActions}
              drawerActions={payload.actions}
              editHref={payload.editHref}
              delete={payload.delete}
              afterDelete={close}
              onDone={reload}
              dense
            />
          </div>
        ) : null}
      </DrawerHeader>
      <DrawerContent>
        {payload && resource && id ? (
          <div key={key} className="fp-space-y-4">
            {payload.deletedTitle ? (
              <HealthBanner
                tone="warn"
                title={payload.deletedTitle}
                description={labels.detail.deletedDescription}
                {...(payload.restorable
                  ? { action: <RestoreButton resource={resource} id={id} onRestored={reload} /> }
                  : {})}
              />
            ) : null}
            <DrawerBody payload={payload} resource={resource} id={id} />
          </div>
        ) : error ? (
          <div role="alert" data-fp-error="" className="fp-text-sm fp-text-err-ink">
            {error}
          </div>
        ) : (
          <LoadingBody label={labels.drawer.loading} />
        )}
      </DrawerContent>
    </Drawer>
  );
}
