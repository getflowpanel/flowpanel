import type { RequestContext, ResolvedAdminConfig, ShellConfig, ShellMode } from "@flowpanel/core";
import { FlowpanelAccessError, FlowpanelAuthError } from "@flowpanel/core";
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
import { buildServerRequest } from "./runtime/build-server-request";
import { buildNav } from "./runtime/nav";
import { bindPublisher } from "./runtime/publish";
import { renderContent } from "./runtime/render-content";
import { buildRequestContext } from "./runtime/request-setup";
import { ThemeVars } from "./runtime/theme-vars";

export { renderContent } from "./runtime/render-content";

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

    const slugPath = `/${slug.join("/")}`;
    const currentPath = slugPath === "/" ? config.basePath || "/" : `${config.basePath}${slugPath}`;
    const url = new URL(`http://localhost${config.basePath}${slugPath}`);
    for (const [k, v] of sp.entries()) url.searchParams.append(k, v);
    const req = await buildServerRequest(url);

    let content: React.ReactNode;
    let reqCtx: RequestContext | undefined;
    let navGroups: Awaited<ReturnType<typeof buildNav>> = [];
    try {
      reqCtx = await buildRequestContext({ req, config });
      navGroups = await buildNav(config, reqCtx);
      content = await renderContent(config, slug, sp, req, reqCtx);
    } catch (err) {
      content = await handleRenderError(err, config);
    }
    const navItems = navGroups.flatMap((g) =>
      g.items.map((it) => ({
        label: it.label,
        href: it.href,
        ...(it.icon ? { icon: it.icon } : {}),
      })),
    );

    const shell = resolveShell(config, opts.shell);
    const themeComponents = config.theme?.components as
      | Partial<FlowpanelComponentSlots>
      | undefined;
    const themeMode = config.theme?.mode;
    const labels = config.labels;
    const accountUser =
      config.theme?.user && reqCtx ? config.theme.user(reqCtx.session) : undefined;

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
        apiBase={config.paths.api}
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
