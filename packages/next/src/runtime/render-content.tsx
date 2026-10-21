import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { accessAllows, mergeLabels, resolveOperationAccess } from "@flowpanel/core";
import { notFound } from "next/navigation";
import type * as React from "react";
import { AuditLogPage } from "../pages/audit/audit-log-page";
import { DashboardPage } from "../pages/dashboard";
import { NotFound } from "../pages/not-found";
import { QueuePage } from "../pages/queue-page";
import { ResourceCreatePage } from "../pages/resource-create";
import { ResourceDetailPage } from "../pages/resource-detail";
import { ResourceEditPage } from "../pages/resource-edit";
import { ResourceListPage } from "../pages/resource-list";
import { UserPage } from "../pages/user-page";
import { Welcome } from "../pages/welcome";
import { AUDIT_LOG_SEGMENT } from "./audit-view";
import { boardLink } from "./board-link";
import { matchDashboard } from "./dashboard-routing";
import { buildHref } from "./href";
import { readableByCaller, resourceNavName } from "./nav";
import { matchPage } from "./page-routing";
import { buildRequestContext } from "./request-setup";
import { requireAccessIfSet } from "./require-access";

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
    await requireAccessIfSet(dash.access, requestContext);
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
    await requireAccessIfSet(userPage.access, requestContext);
    return <UserPage page={userPage} config={config} reqCtx={requestContext} searchParams={sp} />;
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
    if (!queue) notFound();
    await requireAccessIfSet(queue.options.access, requestContext);
    const navigation: { label: string; href: string; active: boolean }[] = [];
    for (const [key, item] of config.queuesByKey) {
      if (!(await accessAllows(item.options.access, requestContext))) continue;
      navigation.push({
        label: item.options.label,
        href: buildHref(config, "queues", key),
        active: key === queueKey,
      });
    }
    const unsigned = "boardSecret" in queue.options && !queue.options.boardSecret;
    return (
      <QueuePage
        label={queue.options.label}
        boardUrl={await boardLink(queue, queueKey)}
        navigation={navigation}
        labels={mergeLabels(config.labels).navigation}
        {...(unsigned && process.env.NODE_ENV !== "production"
          ? {
              devNote:
                "Development note: boardSecret is empty for this queue, so this page cannot sign a link and the board would answer 401. Set BOARD_SECRET where the admin runs to the board's auth.secret, then reload.",
            }
          : {})}
      />
    );
  }

  if (slug[0] === AUDIT_LOG_SEGMENT && slug.length === 1 && config.auditLog) {
    await requireAccessIfSet(config.audit?.access, requestContext);
    return <AuditLogPage config={config} reqCtx={requestContext} searchParams={sp} />;
  }

  const resourceName = slug[0];
  const resource = resourceName ? config.resourcesByName.get(resourceName) : undefined;
  if (!resource) notFound();
  const name = resourceNavName(resource);

  const allow = (operation: "read" | "create" | "update") =>
    requireAccessIfSet(resolveOperationAccess(resource.options.access, operation), requestContext);

  if (slug.length === 1) {
    await allow("read");
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
  if (!id) notFound();
  if (slug.length === 2 && id === "new") {
    await allow("create");
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
    await allow("read");
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
    await allow("update");
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
  notFound();
}
