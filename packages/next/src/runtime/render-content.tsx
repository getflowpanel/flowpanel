import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { checkRequireRole } from "@flowpanel/core";
import type * as React from "react";
import { DashboardPage } from "../pages/dashboard";
import { NotFound } from "../pages/not-found";
import { QueuePage } from "../pages/queue-page";
import { ResourceCreatePage } from "../pages/resource-create";
import { ResourceDetailPage } from "../pages/resource-detail";
import { ResourceEditPage } from "../pages/resource-edit";
import { ResourceListPage } from "../pages/resource-list";
import { UserPage } from "../pages/user-page";
import { Welcome } from "../pages/welcome";
import { roleAllows } from "./action-helpers";
import { matchDashboard } from "./dashboard-routing";
import { buildHref } from "./href";
import { readableByCaller, resourceNavName } from "./nav";
import { matchPage } from "./page-routing";
import { buildRequestContext } from "./request-setup";

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

    let first: ResourceConfig | undefined;
    for (const resource of config.resourcesByName.values()) {
      if (!resource.options.hidden && (await readableByCaller(resource, requestContext))) {
        first = resource;
        break;
      }
    }
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
    const queueKey = slug[1] ?? "";
    const queue = config.queuesByKey.get(queueKey);
    if (!queue) return <NotFound config={config} />;
    if (queue.options.requireRole) {
      checkRequireRole(queue.options.requireRole, requestContext.role, requestContext.session);
    }
    const navigation = [...config.queuesByKey.entries()]
      .filter(([, item]) => roleAllows(item.options.requireRole, requestContext))
      .map(([key, item]) => ({
        label: item.options.label,
        href: buildHref(config, "queues", key),
        active: key === queueKey,
      }));
    return <QueuePage queue={queue} navigation={navigation} />;
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
