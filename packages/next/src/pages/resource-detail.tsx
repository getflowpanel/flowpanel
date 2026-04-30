import type { ItemQueryContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import {
  assertResourceScope,
  checkRequireRole,
  type RequireRole,
  runWithRequestContext,
} from "@flowpanel/core";
import { Button, KV, KVRow, PageHeader } from "@flowpanel/react";
import type * as React from "react";
import { buildRequestContext } from "../runtime/request-setup.js";
import { NotFound } from "./not-found.js";

export interface ResourceDetailPageProps {
  config: ResolvedAdminConfig;
  resource: ResourceConfig;
  name: string;
  id: string;
  req: Request;
}

export async function ResourceDetailPage({
  config,
  resource,
  name,
  id,
  req,
}: ResourceDetailPageProps) {
  const reqCtx = await buildRequestContext({ req, config });
  checkRequireRole(resource.options.requireRole as RequireRole, reqCtx.role, reqCtx.session);
  assertResourceScope({
    hasGlobal: !!config.scope,
    resourceScope: resource.options.scope as "bypass" | ((...a: unknown[]) => unknown) | undefined,
  });

  const ctx: ItemQueryContext = {
    ...reqCtx,
    db: config.adapter.db,
    dateRange: { from: new Date(0), to: new Date() },
    searchParams: new URLSearchParams(),
    signal: new AbortController().signal,
    id,
  };

  const row = (await runWithRequestContext(reqCtx, () =>
    config.adapter.get(resource.ref, ctx),
  )) as Record<string, unknown> | null;

  if (!row) return <NotFound />;

  const pk = (resource.options.rowKey as string | undefined) ?? "id";
  const title = `${resource.options.label ?? name} · ${String(row[pk])}`;

  const editAction = (
    <Button asChild>
      <a href={`/admin/${name}/${id}/edit`}>Edit</a>
    </Button>
  );

  return (
    <>
      {resource.options.update?.disabled ? (
        <PageHeader title={title} />
      ) : (
        <PageHeader title={title} actions={editAction} />
      )}
      <div className="rounded-fp border border-fp-border-1 bg-fp-bg-1 p-6">
        <KV>
          {Object.entries(row).map(([k, v]) => (
            <KVRow key={k} label={k} value={formatValue(v)} />
          ))}
        </KV>
      </div>
    </>
  );
}

function formatValue(v: unknown): React.ReactNode {
  if (v === null || v === undefined) return "—";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
