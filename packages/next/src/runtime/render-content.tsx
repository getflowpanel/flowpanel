import type { RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import { checkRequireRole } from "@flowpanel/core";
import type * as React from "react";
import { DashboardPage } from "../pages/dashboard.js";
import { NotFound } from "../pages/not-found.js";
import { QueuePage } from "../pages/queue-page.js";
import { ResourceCreatePage } from "../pages/resource-create.js";
import { ResourceDetailPage } from "../pages/resource-detail.js";
import { ResourceEditPage } from "../pages/resource-edit.js";
import { ResourceListPage } from "../pages/resource-list.js";
import { UserPage } from "../pages/user-page.js";
import { Welcome } from "../pages/welcome.js";
import { roleAllows } from "./action-helpers.js";
import { matchDashboard } from "./dashboard-routing.js";
import { resourceNavName } from "./nav.js";
import { matchPage } from "./page-routing.js";
import { buildRequestContext } from "./request-setup.js";

/** Resolve an authenticated admin route to its server-rendered page. */
export async function renderContent(
  config: ResolvedAdminConfig,
  slug: string[],
  sp: URLSearchParams,
  req: Request,
  reqCtx?: RequestContext,
): Promise<React.ReactNode> {
  const requestContext = reqCtx ?? (await buildRequestContext({ req, config }));
  const dash = matchDashboard(slug, config);
  if (dash) {
    if (dash.requireRole !== undefined) {
      checkRequireRole(dash.requireRole, requestContext.role, requestContext.session);
    }
    return (
      <DashboardPage
        config={config}
        dashboard={dash}
        searchParams={sp}
        req={req}
        reqCtx={requestContext}
      />
    );
  }

  const userPage = matchPage(slug, config);
  if (userPage) {
    if (userPage.requireRole !== undefined) {
      checkRequireRole(userPage.requireRole, requestContext.role, requestContext.session);
    }
    return <UserPage page={userPage} />;
  }

  if (slug.length === 0) {
    const isEmptyConfig =
      config.resourcesByName.size === 0 &&
      config.dashboardsByPath.size === 0 &&
      config.pagesByPath.size === 0 &&
      config.queuesByKey.size === 0;
    if (isEmptyConfig) return <Welcome />;

    const first = [...config.resourcesByName.values()].find(
      (resource) =>
        !resource.options.hidden && roleAllows(resource.options.requireRole, requestContext),
    );
    if (!first) return <NotFound config={config} />;
    return (
      <ResourceListPage
        config={config}
        resource={first}
        searchParams={sp}
        req={req}
        reqCtx={requestContext}
      />
    );
  }

  if (slug[0] === "queues" && slug.length === 2) {
    const queue = config.queuesByKey.get(slug[1] ?? "");
    if (!queue) return <NotFound config={config} />;
    if (queue.options.requireRole) {
      checkRequireRole(queue.options.requireRole, requestContext.role, requestContext.session);
    }
    return <QueuePage queue={queue} />;
  }

  const resourceName = slug[0];
  if (!resourceName) return <NotFound config={config} />;
  const resource = config.resourcesByName.get(resourceName);
  if (!resource) return <NotFound config={config} />;
  const name = resourceNavName(resource);

  if (slug.length === 1) {
    return (
      <ResourceListPage
        config={config}
        resource={resource}
        searchParams={sp}
        req={req}
        reqCtx={requestContext}
      />
    );
  }

  const id = slug[1];
  if (!id) return <NotFound config={config} />;
  if (slug.length === 2 && id === "new") {
    return (
      <ResourceCreatePage
        config={config}
        resource={resource}
        name={name}
        req={req}
        reqCtx={requestContext}
      />
    );
  }
  if (slug.length === 2) {
    return (
      <ResourceDetailPage
        config={config}
        resource={resource}
        name={name}
        id={id}
        req={req}
        reqCtx={requestContext}
      />
    );
  }
  if (slug.length === 3 && slug[2] === "edit") {
    return (
      <ResourceEditPage
        config={config}
        resource={resource}
        name={name}
        id={id}
        req={req}
        reqCtx={requestContext}
      />
    );
  }
  return <NotFound config={config} />;
}
