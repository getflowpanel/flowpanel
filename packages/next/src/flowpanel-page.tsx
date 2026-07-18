import type { ResolvedAdminConfig, ShellConfig, ShellMode } from "@flowpanel/core";
import { checkRequireRole, FlowpanelAccessError, FlowpanelAuthError } from "@flowpanel/core";
import { CommandHost, DrawerHost } from "@flowpanel/next/client";
import {
  AdminShell,
  EmptyState,
  type FlowpanelComponentSlots,
  FlowpanelGlobals,
  type ShellBrand,
} from "@flowpanel/react";
import { redirect } from "next/navigation";
import type * as React from "react";
import { DashboardPage } from "./pages/dashboard.js";
import { NotFound } from "./pages/not-found.js";
import { QueuePage } from "./pages/queue-page.js";
import { ResourceCreatePage } from "./pages/resource-create.js";
import { ResourceDetailPage } from "./pages/resource-detail.js";
import { ResourceEditPage } from "./pages/resource-edit.js";
import { ResourceListPage } from "./pages/resource-list.js";
import { UserPage } from "./pages/user-page.js";
import { buildServerRequest } from "./runtime/build-server-request.js";
import { matchDashboard } from "./runtime/dashboard-routing.js";
import { buildNav, resourceNavName } from "./runtime/nav.js";
import { matchPage } from "./runtime/page-routing.js";
import { bindPublisher } from "./runtime/publish.js";
import { buildRequestContext } from "./runtime/request-setup.js";
import { ThemeVars } from "./runtime/theme-vars.js";

type PageParams = Record<string, string | string[] | undefined>;
type PageProps = {
  params: Promise<PageParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function resolveCatchAllSegments(params: PageParams): string[] {
  const slug = params.slug;
  if (Array.isArray(slug)) return slug;
  const rest = params.rest;
  if (Array.isArray(rest)) return rest;
  for (const v of Object.values(params)) {
    if (Array.isArray(v)) return v;
  }
  return [];
}

export interface FlowpanelOptions {
  /** Override `config.shell` at render time. */
  shell?: ShellConfig | ShellMode;
}

interface ResolvedShell {
  mode: ShellMode;
  brand?: ShellBrand;
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
  const override_ = cfg.brand && typeof cfg.brand === "object" ? cfg.brand : undefined;
  const themeBrand = config.theme?.brand;
  const brand: ShellBrand = {
    ...(themeBrand ?? {}),
    ...(override_ ?? {}),
  };
  const hasBrand = brand.name !== undefined || brand.logo !== undefined;
  return { mode, ...(hasBrand ? { brand } : {}) };
}

/** Mount the admin UI as a Next.js page component. */
export function Flowpanel(config: ResolvedAdminConfig, opts: FlowpanelOptions = {}) {
  bindPublisher(config);
  return async function FlowpanelPage({ params, searchParams }: PageProps) {
    const slug = resolveCatchAllSegments(await params);
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
    const currentPath = slugPath === "/" ? config.basePath || "/" : `${config.basePath}${slugPath}`;
    const url = new URL(`http://localhost${config.basePath}${slugPath}`);
    for (const [k, v] of sp.entries()) url.searchParams.append(k, v);
    const req = await buildServerRequest(url);

    let content: React.ReactNode;
    try {
      content = await renderContent(config, slug, sp, req);
    } catch (err) {
      content = await handleRenderError(err, config);
    }

    const shell = resolveShell(config, opts.shell);
    const themeComponents = config.theme?.components as
      | Partial<FlowpanelComponentSlots>
      | undefined;
    const themeMode = config.theme?.mode;
    const labels = config.labels;
    const accountUser = config.theme?.user
      ? config.theme.user(await config.auth.session().catch(() => null))
      : undefined;

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
          currentPath={slug.length === 0 ? config.basePath || "/" : currentPath}
          {...(shell.brand !== undefined ? { brand: shell.brand } : {})}
          {...(accountUser ? { user: accountUser } : {})}
        >
          {content}
          {globals}
        </AdminShell>
      );

    return (
      <FlowpanelGlobals
        {...(themeComponents ? { themeComponents } : {})}
        {...(themeMode ? { themeMode } : {})}
        {...(labels ? { labels } : {})}
      >
        <ThemeVars theme={config.theme} />
        {body}
      </FlowpanelGlobals>
    );
  };
}

/** Sugar for `Flowpanel(config, { shell: "bare" })`. */
export function FlowpanelContent(
  config: ResolvedAdminConfig,
  opts: Omit<FlowpanelOptions, "shell"> = {},
) {
  return Flowpanel(config, { ...opts, shell: "bare" });
}

/** Render-path auth boundary. */
export async function handleRenderError(
  err: unknown,
  config: ResolvedAdminConfig,
): Promise<React.ReactNode> {
  if (!(err instanceof FlowpanelAccessError) && !(err instanceof FlowpanelAuthError)) {
    throw err;
  }

  const session = await config.auth.session().catch(() => null);
  const isAuthError = err instanceof FlowpanelAuthError || session === null;
  const target = isAuthError ? config.auth.signInUrl : config.auth.forbiddenUrl;
  if (target) redirect(target);

  return isAuthError ? (
    <EmptyState title="Sign in required" description="You need to sign in to view this admin." />
  ) : (
    <EmptyState
      title="Access denied"
      description="Your account doesn't have permission to view this admin."
    />
  );
}

export async function renderContent(
  config: ResolvedAdminConfig,
  slug: string[],
  sp: URLSearchParams,
  req: Request,
): Promise<React.ReactNode> {
  const dash = matchDashboard(slug, config);
  if (dash) {
    const reqCtx = await buildRequestContext({ req, config });
    if (dash.requireRole !== undefined) {
      checkRequireRole(dash.requireRole, reqCtx.role, reqCtx.session);
    }
    return (
      <DashboardPage config={config} dashboard={dash} searchParams={sp} req={req} reqCtx={reqCtx} />
    );
  }

  const userPage = matchPage(slug, config);
  if (userPage) {
    const reqCtx = await buildRequestContext({ req, config });
    if (userPage.requireRole !== undefined) {
      checkRequireRole(userPage.requireRole, reqCtx.role, reqCtx.session);
    }
    return <UserPage page={userPage} />;
  }

  if (slug.length === 0) {
    const first = config.resources?.[0];
    if (!first) return <NotFound config={config} />;
    return <ResourceListPage config={config} resource={first} searchParams={sp} req={req} />;
  }

  if (slug[0] === "queues" && slug.length === 2) {
    const qkey = slug[1] ?? "";
    const q = config.queuesByKey.get(qkey);
    if (q) {
      const reqCtx = await buildRequestContext({ req, config });
      if (q.options.requireRole) {
        checkRequireRole(q.options.requireRole, reqCtx.role, reqCtx.session);
      }
      return <QueuePage queue={q} />;
    }
    return <NotFound config={config} />;
  }

  const resourceName = slug[0];
  if (!resourceName) return <NotFound config={config} />;
  const resource = config.resourcesByName.get(resourceName);
  if (!resource) return <NotFound config={config} />;
  const name = resourceNavName(resource);

  if (slug.length === 1) {
    return <ResourceListPage config={config} resource={resource} searchParams={sp} req={req} />;
  }

  const second = slug[1];
  if (!second) return <NotFound config={config} />;
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
  return <NotFound config={config} />;
}
