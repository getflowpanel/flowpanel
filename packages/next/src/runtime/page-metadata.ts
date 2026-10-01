import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { accessAllows, formatLabel, mergeLabels, resolveOperationAccess } from "@flowpanel/core";
import { roleAllows } from "./action-helpers";
import { buildServerRequest } from "./build-server-request";
import { matchDashboard } from "./dashboard-routing";
import { decodeAtom } from "./href";
import { readableByCaller } from "./nav";
import { matchPage } from "./page-routing";
import { buildRequestContext } from "./request-setup";
import { pluralLabel, singularLabel } from "./resource-title";

type Params = Record<string, string | string[] | undefined>;

/** The part of Next's `Metadata` the admin fills. */
export interface FlowpanelMetadata {
  title?: string;
  robots: { index: false; follow: false };
}

const NO_INDEX = { index: false, follow: false } as const;

function segments(params: Params): string[] {
  const slug = Object.values(params).find(Array.isArray) ?? [];
  return slug.map(decodeAtom);
}

function creatableByCaller(resource: ResourceConfig, reqCtx: RequestContext): Promise<boolean> {
  if (resource.options.create?.disabled) return Promise.resolve(false);
  return accessAllows(resolveOperationAccess(resource.options.access, "create"), reqCtx);
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
  const [name, id, rest] = slug;
  if (name === "queues" && id && !rest) return config.queuesByKey.get(id)?.options.label;
  if (name === undefined) return config.theme?.brand?.name;
  const resource = config.resourcesByName.get(name);
  if (!resource) return labels.notFound.title;
  if (!(await readableByCaller(resource, reqCtx))) return undefined;
  if (id === undefined) return pluralLabel(resource, name);
  if (id === "new" && !rest) {
    if (!(await creatableByCaller(resource, reqCtx))) return undefined;
    return formatLabel(labels.form.createTitle, { label: singularLabel(resource, name) });
  }
  return singularLabel(resource, name);
}

/**
 * `generateMetadata` for the admin's catch-all page: each page's `<title>` is its dashboard, list or record name.
 * A page the caller may not open names nothing, a signed-out visitor sees no admin label, and no page is indexed.
 */
export function flowpanelMetadata(config: ResolvedAdminConfig) {
  return async function generateMetadata({
    params,
  }: {
    params: Promise<Params>;
  }): Promise<FlowpanelMetadata> {
    const slug = segments(await params);
    try {
      const url = new URL(`http://localhost${config.basePath}/${slug.join("/")}`);
      const reqCtx = await buildRequestContext({ req: await buildServerRequest(url), config });
      if (reqCtx.session === null) return { robots: NO_INDEX };
      const title = await titleFor(config, slug, reqCtx);
      return title === undefined ? { robots: NO_INDEX } : { title, robots: NO_INDEX };
    } catch {
      return { robots: NO_INDEX };
    }
  };
}
