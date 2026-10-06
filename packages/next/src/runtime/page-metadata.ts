import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import {
  accessAllows,
  FlowpanelAccessError,
  FlowpanelAuthError,
  mergeLabels,
  resolveOperationAccess,
} from "@flowpanel/core";
import { roleAllows } from "./action-helpers";
import { matchDashboard } from "./dashboard-routing";
import { decodeAtom } from "./href";
import { readableByCaller } from "./nav";
import { matchPage } from "./page-routing";
import { type PageParams, pageRequest, resolveCatchAllSegments, toSearchParams } from "./page-url";
import { buildRequestContext } from "./request-setup";
import { pluralLabel, singularLabel, singularTitle } from "./resource-title";

/** The part of Next's `Metadata` the admin fills. */
export interface FlowpanelMetadata {
  title?: string;
  robots: { index: false; follow: false };
}

const NO_INDEX = { index: false, follow: false } as const;

function allowedForCaller(
  resource: ResourceConfig,
  operation: "create" | "update",
  reqCtx: RequestContext,
): Promise<boolean> {
  if (resource.options[operation]?.disabled) return Promise.resolve(false);
  return accessAllows(resolveOperationAccess(resource.options.access, operation), reqCtx);
}

async function titleFor(
  config: ResolvedAdminConfig,
  slug: string[],
  reqCtx: RequestContext,
): Promise<string | undefined> {
  const labels = mergeLabels(config.labels);
  const dashboard = matchDashboard(slug, config);
  if (dashboard) return roleAllows(dashboard.requireRole, reqCtx) ? dashboard.label : undefined;
  const page = matchPage(slug, config);
  if (page) return roleAllows(page.requireRole, reqCtx) ? page.label : undefined;
  const [name, id, rest, ...extra] = slug;
  if (name === "queues" && id && rest === undefined) {
    const queue = config.queuesByKey.get(id);
    if (!queue) return labels.notFound.title;
    return roleAllows(queue.options.requireRole, reqCtx) ? queue.options.label : undefined;
  }
  if (name === undefined) return config.theme?.brand?.name;
  const resource = config.resourcesByName.get(name);
  if (!resource) return labels.notFound.title;
  if (!(await readableByCaller(resource, reqCtx))) return undefined;
  if (id === undefined) return pluralLabel(resource, name);
  if (extra.length > 0 || (rest !== undefined && rest !== "edit")) return labels.notFound.title;
  if (id === "new" && !rest) {
    if (!(await allowedForCaller(resource, "create", reqCtx))) return undefined;
    return singularTitle(labels.form.createTitle, resource, name);
  }
  if (rest === "edit") {
    if (!(await allowedForCaller(resource, "update", reqCtx))) return undefined;
    return singularTitle(labels.form.editTitle, resource, name);
  }
  return singularLabel(resource, name);
}

/** The title of the sign-in or access-denied wall the page shows for this error, as `handleRenderError` picks it. */
async function wallTitle(
  err: unknown,
  config: ResolvedAdminConfig,
  req: Request | undefined,
): Promise<string | undefined> {
  if (!(err instanceof FlowpanelAccessError) && !(err instanceof FlowpanelAuthError))
    return undefined;
  const session = req ? await config.auth.session(req).catch(() => null) : null;
  const { access } = mergeLabels(config.labels);
  return err instanceof FlowpanelAuthError || session === null
    ? access.signInTitle
    : access.deniedTitle;
}

/** The `metadata` of the admin's `not-found.tsx`, so the server's HTML is titled "Page not found" too. */
export function flowpanelNotFoundMetadata(config: ResolvedAdminConfig): FlowpanelMetadata {
  return { title: mergeLabels(config.labels).notFound.title, robots: NO_INDEX };
}

/**
 * `generateMetadata` for the admin's catch-all page: each page's `<title>` is its dashboard, list or record name.
 * A page the caller may not open names nothing, a signed-out visitor sees only the sign-in title, and no page is indexed.
 */
export function flowpanelMetadata(config: ResolvedAdminConfig) {
  return async function generateMetadata({
    params,
    searchParams,
  }: {
    params: Promise<PageParams>;
    searchParams?: Promise<PageParams>;
  }): Promise<FlowpanelMetadata> {
    const slug = resolveCatchAllSegments(await params).map(decodeAtom);
    let req: Request | undefined;
    try {
      const sp = toSearchParams(await searchParams);
      req = (await pageRequest(config, slug, sp)).req;
      const reqCtx = await buildRequestContext({ req, config });
      if (reqCtx.session === null) {
        return { title: mergeLabels(config.labels).access.signInTitle, robots: NO_INDEX };
      }
      const title = await titleFor(config, slug, reqCtx);
      return title === undefined ? { robots: NO_INDEX } : { title, robots: NO_INDEX };
    } catch (err) {
      const title = await wallTitle(err, config, req);
      return title === undefined ? { robots: NO_INDEX } : { title, robots: NO_INDEX };
    }
  };
}
