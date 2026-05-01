import type { ResolvedAdminConfig } from "@flowpanel/core";
import { CommandHost, DrawerHost } from "@flowpanel/next/client";
import { AdminShell } from "@flowpanel/react";
import type * as React from "react";
import { DashboardPage } from "./pages/dashboard.js";
import { NotFound } from "./pages/not-found.js";
import { ResourceCreatePage } from "./pages/resource-create.js";
import { ResourceDetailPage } from "./pages/resource-detail.js";
import { ResourceEditPage } from "./pages/resource-edit.js";
import { ResourceListPage } from "./pages/resource-list.js";
import { matchDashboard } from "./runtime/dashboard-routing.js";
import { buildNav, resourceNavName } from "./runtime/nav.js";

type PageParams = { slug?: string[] };
type PageProps = {
  params: Promise<PageParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function Flowpanel(config: ResolvedAdminConfig) {
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

    const brandName = config.theme?.brand?.name;
    return (
      <AdminShell
        navGroups={navGroups}
        currentPath={slug.length === 0 ? "/admin" : currentPath}
        {...(brandName ? { brandName } : {})}
      >
        {content}
        <DrawerHost />
        <CommandHost
          navItems={navItems}
          {...(config.commandPalette ? { config: config.commandPalette } : {})}
        />
      </AdminShell>
    );
  };
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
