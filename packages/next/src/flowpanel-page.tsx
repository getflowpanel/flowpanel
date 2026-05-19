import type { ResolvedAdminConfig, RequireRole, ShellConfig, ShellMode } from "@flowpanel/core";
import { checkRequireRole } from "@flowpanel/core";
import { CommandHost, DrawerHost } from "@flowpanel/next/client";
import { AdminShell, type FlowpanelComponentSlots, FlowpanelGlobals } from "@flowpanel/react";
import type * as React from "react";
import { DashboardPage } from "./pages/dashboard.js";
import { NotFound } from "./pages/not-found.js";
import { QueuePage } from "./pages/queue-page.js";
import { ResourceCreatePage } from "./pages/resource-create.js";
import { ResourceDetailPage } from "./pages/resource-detail.js";
import { ResourceEditPage } from "./pages/resource-edit.js";
import { ResourceListPage } from "./pages/resource-list.js";
import { matchDashboard } from "./runtime/dashboard-routing.js";
import { buildNav, resourceNavName } from "./runtime/nav.js";
import { bindPublisher } from "./runtime/publish.js";
import { buildRequestContext } from "./runtime/request-setup.js";

type PageParams = { slug?: string[] };
type PageProps = {
  params: Promise<PageParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export interface FlowpanelOptions {
  /**
   * Override `config.shell` at render time. Useful when the same admin
   * config is mounted at different routes with different chrome (e.g.
   * standalone `/admin` with sidebar, embedded `/dashboard/admin` with
   * tabs).
   */
  shell?: ShellConfig | ShellMode;
}

interface ResolvedShell {
  mode: ShellMode;
  brandName?: string;
}

function resolveShell(
  config: ResolvedAdminConfig,
  override?: ShellConfig | ShellMode,
): ResolvedShell {
  const raw = override ?? config.shell;
  const cfg: ShellConfig = typeof raw === "string" ? { mode: raw } : (raw ?? {});
  const mode: ShellMode = cfg.mode ?? "sidebar";

  if (cfg.brand === false || mode === "bare") {
    return { mode };
  }
  const brandName =
    (cfg.brand && typeof cfg.brand === "object" ? cfg.brand.name : undefined) ??
    config.theme?.brand?.name;
  return { mode, ...(brandName !== undefined ? { brandName } : {}) };
}

export function Flowpanel(config: ResolvedAdminConfig, opts: FlowpanelOptions = {}) {
  bindPublisher(config);
  return async function FlowpanelPage({ params, searchParams }: PageProps) {
    const { slug = [] } = await params;
    const spRaw = await searchParams;
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(spRaw)) {
      if (Array.isArray(v)) {
        for (const item of v) sp.append(k, item);
      } else if (v !== undefined) {
        sp.set(k, v);
      }
    }

    const navGroups = buildNav(config);
    const navItems = navGroups.flatMap((g) =>
      g.items.map((it) => ({ label: it.label, href: it.href })),
    );
    const slugPath = `/${slug.join("/")}`;
    const currentPath = `/admin${slugPath === "/" ? "" : slugPath}`;
    const url = new URL(`http://localhost/admin${slugPath}`);
    for (const [k, v] of sp.entries()) url.searchParams.append(k, v);
    const req = new Request(url);

    const content = await renderContent(config, slug, sp, req);

    const shell = resolveShell(config, opts.shell);
    const themeComponents = config.theme?.components as
      | Partial<FlowpanelComponentSlots>
      | undefined;
    const labels = config.labels;

    const globals = (
      <>
        <DrawerHost />
        <CommandHost
          navItems={navItems}
          {...(config.commandPalette ? { config: config.commandPalette } : {})}
        />
      </>
    );

    const body =
      shell.mode === "bare" ? (
        <>
          {content}
          {globals}
        </>
      ) : (
        <AdminShell
          variant={shell.mode}
          navGroups={navGroups}
          currentPath={slug.length === 0 ? "/admin" : currentPath}
          {...(shell.brandName !== undefined ? { brandName: shell.brandName } : {})}
        >
          {content}
          {globals}
        </AdminShell>
      );

    return (
      <FlowpanelGlobals
        {...(themeComponents ? { themeComponents } : {})}
        {...(labels ? { labels } : {})}
      >
        {body}
      </FlowpanelGlobals>
    );
  };
}

/**
 * Sugar for `Flowpanel(config, { shell: "bare" })`. Renders only the page
 * content — the host app provides chrome via its own `app/layout.tsx` or
 * a wrapper component. Globals (toasts, drawer, ⌘K, realtime) are still
 * mounted, so feature parity is preserved.
 */
export function FlowpanelContent(
  config: ResolvedAdminConfig,
  opts: Omit<FlowpanelOptions, "shell"> = {},
) {
  return Flowpanel(config, { ...opts, shell: "bare" });
}

async function renderContent(
  config: ResolvedAdminConfig,
  slug: string[],
  sp: URLSearchParams,
  req: Request,
): Promise<React.ReactNode> {
  // Dashboards take priority over resources — a dashboard registered at
  // "/" + slug.join("/") intercepts before the resource fallthrough.
  const dash = matchDashboard(slug, config);
  if (dash) {
    const session = await config.auth.session();
    return (
      <DashboardPage
        config={config}
        dashboard={dash}
        searchParams={sp}
        req={req}
        session={session}
      />
    );
  }

  if (slug.length === 0) {
    const first = config.resources?.[0];
    if (!first) return <NotFound />;
    return <ResourceListPage config={config} resource={first} searchParams={sp} req={req} />;
  }

  if (slug[0] === "queues" && slug.length === 2) {
    const qkey = slug[1] ?? "";
    const q = config.queuesByKey.get(qkey);
    if (q) {
      if (q.options.requireRole) {
        const reqCtx = await buildRequestContext({ req, config });
        checkRequireRole(q.options.requireRole as RequireRole, reqCtx.role, reqCtx.session);
      }
      return <QueuePage queue={q} />;
    }
    return <NotFound />;
  }

  const resourceName = slug[0];
  if (!resourceName) return <NotFound />;
  const resource = config.resourcesByName.get(resourceName);
  if (!resource) return <NotFound />;
  const name = resourceNavName(resource);

  if (slug.length === 1) {
    return <ResourceListPage config={config} resource={resource} searchParams={sp} req={req} />;
  }

  const second = slug[1];
  if (!second) return <NotFound />;
  if (slug.length === 2 && second === "new") {
    return <ResourceCreatePage config={config} resource={resource} name={name} req={req} />;
  }
  if (slug.length === 2) {
    return (
      <ResourceDetailPage config={config} resource={resource} name={name} id={second} req={req} />
    );
  }
  if (slug.length === 3 && slug[2] === "edit") {
    return (
      <ResourceEditPage config={config} resource={resource} name={name} id={second} req={req} />
    );
  }
  return <NotFound />;
}
