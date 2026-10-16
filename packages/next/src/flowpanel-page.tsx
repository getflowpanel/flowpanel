import type { RequestContext, ResolvedAdminConfig, ShellConfig, ShellMode } from "@flowpanel/core";
import {
  FlowpanelError,
  FlowpanelRateLimitError,
  mergeLabels,
  reportUnexpectedError,
} from "@flowpanel/core";
import { CommandHost, DrawerHost, NotFoundBody, PathAwareShell } from "@flowpanel/next/client";
import {
  AdminShell,
  type FlowpanelComponentSlots,
  FlowpanelGlobals,
  type NavGroup,
  type ShellBrand,
} from "@flowpanel/react";
import type * as React from "react";
import { Suspense } from "react";
import { missingRecordCopy, NotFound } from "./pages/not-found";
import { accountUser } from "./runtime/account-user";
import { buildServerRequest } from "./runtime/build-server-request";
import { buildHref, decodeAtom } from "./runtime/href";
import { buildNav } from "./runtime/nav";
import {
  type PageParams,
  pageRequest,
  resolveCatchAllSegments,
  toSearchParams,
} from "./runtime/page-url";
import { bindPublisher } from "./runtime/publish";
import { isControlFlow } from "./runtime/query-error";
import { renderContent } from "./runtime/render-content";
import { buildRequestContext, requestIdFrom } from "./runtime/request-setup";
import { ThemeColor, ThemeVars } from "./runtime/theme-vars";
import { handleRenderError, sessionFailedWall } from "./runtime/walls";

export { renderContent } from "./runtime/render-content";
export { handleRenderError } from "./runtime/walls";

type PageProps = {
  params: Promise<PageParams>;
  searchParams: Promise<PageParams>;
};

export { resolveCatchAllSegments };

export interface FlowpanelOptions {
  /** Override `config.shell` at render time. */
  shell?: ShellConfig | ShellMode;
}

interface ResolvedShell {
  mode: ShellMode;
  brand?: ShellBrand;
  showSkipLink: boolean;
}

function resolveShell(
  config: ResolvedAdminConfig,
  override?: ShellConfig | ShellMode,
): ResolvedShell {
  const raw = override ?? config.shell;
  const cfg: ShellConfig = typeof raw === "string" ? { mode: raw } : (raw ?? {});
  const mode: ShellMode = cfg.mode ?? "sidebar";
  const showSkipLink = cfg.skipLink !== false;

  if (cfg.brand === false || mode === "bare") {
    return { mode, showSkipLink };
  }
  const override_ = cfg.brand && typeof cfg.brand === "object" ? cfg.brand : undefined;
  const themeBrand = config.theme?.brand;
  const brand: ShellBrand = {
    ...(themeBrand ?? {}),
    ...(override_ ?? {}),
  };
  const hasBrand = brand.name !== undefined || brand.logo !== undefined;
  return { mode, showSkipLink, ...(hasBrand ? { brand } : {}) };
}

/** Mount the admin UI as a Next.js page component. */
export function Flowpanel(config: ResolvedAdminConfig, opts: FlowpanelOptions = {}) {
  bindPublisher(config);
  return async function FlowpanelPage({ params, searchParams }: PageProps) {
    // Next hands catch-all segments over still percent-encoded, so an id carrying `/` needs one decode.
    const slug = resolveCatchAllSegments(await params).map(decodeAtom);
    const sp = toSearchParams(await searchParams);
    const { path: currentPath, req } = await pageRequest(config, slug, sp);

    let content: React.ReactNode;
    let reqCtx: RequestContext | undefined;
    let navGroups: NavGroup[] = [];
    try {
      reqCtx = await buildRequestContext({ req, config });
      navGroups = await buildNav(config, reqCtx);
      content = await renderContent(config, slug, sp, req, reqCtx);
    } catch (err) {
      const admitted = reqCtx !== undefined;
      if (!admitted && !(err instanceof FlowpanelError) && !isControlFlow(err)) {
        const requestId = requestIdFrom(req);
        await reportUnexpectedError(
          err,
          { requestId, route: "page", method: "GET", url: req.url, ip: null, userAgent: null },
          config.hooks?.onError,
        );
        return (
          <AdminFrame config={config}>
            <main id="main">{sessionFailedWall(config, requestId, err)}</main>
          </AdminFrame>
        );
      }
      if (err instanceof FlowpanelRateLimitError && !admitted) {
        reqCtx = await buildRequestContext({ req, config, rateLimit: false }).catch(
          () => undefined,
        );
        navGroups = reqCtx ? await buildNav(config, reqCtx) : [];
      }
      content = await handleRenderError(
        err,
        config,
        req,
        admitted ? { slug, currentPath, navGroups } : undefined,
      );
    }
    return (
      <AdminFrame config={config}>
        <AdminChrome
          config={config}
          shell={opts.shell}
          navGroups={navGroups}
          reqCtx={reqCtx}
          currentPath={currentPath}
        >
          {content}
        </AdminChrome>
      </AdminFrame>
    );
  };
}

/** The shell around a page's content, with the drawer and the command palette; `currentPath` unset reads it in the browser. */
function AdminChrome({
  config,
  shell: override,
  navGroups,
  reqCtx,
  currentPath,
  children,
}: {
  config: ResolvedAdminConfig;
  shell: FlowpanelOptions["shell"];
  navGroups: NavGroup[];
  reqCtx: RequestContext | undefined;
  currentPath?: string;
  children: React.ReactNode;
}) {
  const navItems = navGroups.flatMap((g) =>
    g.items.map((it) => ({
      label: it.label,
      href: it.href,
      ...(it.icon ? { icon: it.icon } : {}),
    })),
  );
  const shell = resolveShell(config, override);
  const user = reqCtx ? accountUser(config, reqCtx.session) : undefined;
  const globals = (
    <>
      <DrawerHost />
      <CommandHost
        navItems={navItems}
        {...(config.commandPalette || config.theme?.mode === "host"
          ? {
              config: {
                ...config.commandPalette,
                ...(config.theme?.mode === "host" ? { disableTheme: true } : {}),
              },
            }
          : {})}
      />
    </>
  );
  if (shell.mode === "bare") {
    return (
      <>
        {children}
        {globals}
      </>
    );
  }
  const props = {
    variant: shell.mode,
    navGroups,
    rootHref: buildHref(config),
    showSkipLink: shell.showSkipLink,
    ...(shell.brand !== undefined ? { brand: shell.brand } : {}),
    ...(user ? { user } : {}),
  };
  return currentPath === undefined ? (
    <PathAwareShell {...props}>
      {children}
      {globals}
    </PathAwareShell>
  ) : (
    <AdminShell {...props} currentPath={currentPath}>
      {children}
      {globals}
    </AdminShell>
  );
}

function AdminFrame({
  config,
  children,
}: {
  config: ResolvedAdminConfig;
  children: React.ReactNode;
}) {
  const themeComponents = config.theme?.components as Partial<FlowpanelComponentSlots> | undefined;
  const mode = config.theme?.mode;
  const themeMode = mode === "host" ? undefined : mode;
  const labels = config.labels;
  return (
    <FlowpanelGlobals
      apiBase={config.paths.api}
      {...(config.formatting ? { formatting: config.formatting } : {})}
      {...(themeComponents ? { themeComponents } : {})}
      {...(themeMode ? { themeMode } : {})}
      {...(mode === "host" ? { followHost: true } : {})}
      {...(labels ? { labels } : {})}
    >
      <ThemeVars theme={config.theme} />
      <ThemeColor theme={config.theme} />
      {children}
    </FlowpanelGlobals>
  );
}

/** The admin's not-found page for the host's `not-found.tsx`, inside the shell, naming a missing record's list. */
export function FlowpanelNotFound(config: ResolvedAdminConfig, opts: FlowpanelOptions = {}) {
  return function FlowpanelNotFoundPage() {
    return (
      <AdminFrame config={config}>
        <title>{mergeLabels(config.labels).notFound.title}</title>
        <Suspense fallback={<NotFound config={config} />}>
          <NotFoundInShell config={config} shell={opts.shell} />
        </Suspense>
      </AdminFrame>
    );
  };
}

async function NotFoundInShell({
  config,
  shell,
}: {
  config: ResolvedAdminConfig;
  shell: FlowpanelOptions["shell"];
}) {
  const req = await buildServerRequest(`http://localhost${buildHref(config)}`);
  const reqCtx = await buildRequestContext({ req, config, rateLimit: false }).catch(
    () => undefined,
  );
  if (!reqCtx) return <NotFound config={config} />;
  const { notFound } = mergeLabels(config.labels);
  const [navGroups, records] = await Promise.all([
    buildNav(config, reqCtx),
    missingRecordCopy(config, reqCtx),
  ]);
  return (
    <AdminChrome config={config} shell={shell} navGroups={navGroups} reqCtx={reqCtx}>
      <NotFoundBody
        adminPath={buildHref(config)}
        title={notFound.title}
        description={notFound.description}
        back={notFound.back}
        recordDescription={notFound.recordDescription}
        records={records}
      />
    </AdminChrome>
  );
}

/** Sugar for `Flowpanel(config, { shell: "bare" })`. */
export function FlowpanelContent(
  config: ResolvedAdminConfig,
  opts: Omit<FlowpanelOptions, "shell"> = {},
) {
  return Flowpanel(config, { ...opts, shell: "bare" });
}
