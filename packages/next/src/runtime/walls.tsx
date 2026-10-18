import type { ResolvedAdminConfig } from "@flowpanel/core";
import {
  FlowpanelAccessError,
  FlowpanelAuthError,
  FlowpanelConfigError,
  FlowpanelRateLimitError,
  formatLabel,
  mergeLabels,
} from "@flowpanel/core";
import { authProvider } from "@flowpanel/core/internal";
import { RefreshButton, RequestId } from "@flowpanel/next/client";
import { Button, type NavGroup } from "@flowpanel/react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type * as React from "react";
import { Wall } from "../pages/wall";
import { AUDIT_LOG_SEGMENT } from "./audit-view";
import { matchDashboard } from "./dashboard-routing";
import { DevAuthNote, warnNoSession } from "./dev-auth-note";
import { matchPage } from "./page-routing";
import { pluralLabel } from "./resource-title";

/** Where the refused page sits, once the reader got past the admin's own `auth.access`. */
export interface RefusedPlace {
  slug: readonly string[];
  currentPath: string;
  navGroups: readonly NavGroup[];
}

/** The name of the dashboard, page, queue or resource a URL opens, as its nav entry shows it. */
export function sectionLabel(config: ResolvedAdminConfig, slug: readonly string[]): string | null {
  const parts = [...slug];
  const dashboard = matchDashboard(parts, config);
  if (dashboard) return dashboard.label;
  const page = matchPage(parts, config);
  if (page) return page.label;
  const [head, key] = parts;
  if (head === AUDIT_LOG_SEGMENT && key === undefined && config.auditLog) {
    return mergeLabels(config.labels).audit.title;
  }
  if (head === "queues" && key) return config.queuesByKey.get(key)?.options.label ?? null;
  const resource = head ? config.resourcesByName.get(head) : undefined;
  return resource && head ? pluralLabel(resource, head) : null;
}

/** The nav entry the refused page sits under, such as the list of a record's edit page, else the first other one. */
function wayBack(place: RefusedPlace): { label: string; href: string } | null {
  const items = place.navGroups.flatMap((group) => group.items);
  const parents = items.filter((item) => place.currentPath.startsWith(`${item.href}/`));
  const parent = parents.sort((a, b) => b.href.length - a.href.length)[0];
  const back = parent ?? items.find((item) => item.href !== place.currentPath);
  return back ? { label: back.label, href: back.href } : null;
}

function switchAccount(config: ResolvedAdminConfig, label: string): React.ReactNode {
  const url = config.auth.signInUrl;
  if (!url) return null;
  return (
    <Button asChild variant="outline">
      <a href={url}>{label}</a>
    </Button>
  );
}

/** The in-admin wall for one dashboard, page, queue, audit log or resource route the role may not open. */
function deniedSectionWall(
  config: ResolvedAdminConfig,
  place: RefusedPlace,
  section: string,
): React.ReactNode {
  const { access } = mergeLabels(config.labels);
  const back = wayBack(place);
  return (
    <Wall
      title={formatLabel(access.deniedSectionTitle, { label: section })}
      description={access.deniedSectionDescription}
      actions={
        <>
          {back ? (
            <Button asChild>
              <Link href={back.href} prefetch={false}>
                {formatLabel(access.back, { label: back.label })}
              </Link>
            </Button>
          ) : null}
          {switchAccount(config, access.switchAccount) ??
            (back ? null : <RefreshButton label={access.reload} variant="outline" />)}
        </>
      }
    />
  );
}

/** The wall for a visitor with no session; in development it says how to wire one. */
function signInWall(config: ResolvedAdminConfig): React.ReactNode {
  const { access } = mergeLabels(config.labels);
  const developing = process.env.NODE_ENV !== "production";
  const provider = authProvider(config.auth);
  if (developing) warnNoSession(provider);
  return (
    <Wall
      title={access.signInTitle}
      description={access.signInDescription}
      actions={<RefreshButton label={access.reload} variant="outline" />}
    >
      {developing ? <DevAuthNote provider={provider} /> : null}
    </Wall>
  );
}

/** The wall for a signed-in visitor `auth.access` keeps out of the whole admin. */
function deniedWall(config: ResolvedAdminConfig): React.ReactNode {
  const { access } = mergeLabels(config.labels);
  return (
    <Wall
      title={access.deniedTitle}
      description={access.deniedDescription}
      actions={
        switchAccount(config, access.switchAccount) ?? (
          <RefreshButton label={access.reload} variant="outline" />
        )
      }
    />
  );
}

/** The wall for a request whose reader could not be read: `auth.session` or `scope` threw, as a development stub does in production. */
export function sessionFailedWall(
  config: ResolvedAdminConfig,
  requestId: string,
  cause: unknown,
): React.ReactNode {
  const { errors } = mergeLabels(config.labels);
  const message = cause instanceof Error ? cause.message : "";
  const configured = cause instanceof FlowpanelConfigError;
  const shown = !configured && process.env.NODE_ENV !== "production";
  return (
    <Wall
      title={errors.title}
      description={configured ? message : `${errors.loadHint} ${errors.reportHint}`}
      actions={
        <>
          {configured ? null : <RefreshButton label={errors.retry} variant="outline" />}
          <RequestId id={requestId} />
        </>
      }
    >
      {shown && message ? (
        <p className="fp-max-w-md fp-break-words fp-font-mono fp-text-xs fp-text-faint">
          {message}
        </p>
      ) : null}
    </Wall>
  );
}

/** The page's sign-in, access-denied or rate-limited wall, unless auth redirects; other errors rethrow. */
export async function handleRenderError(
  err: unknown,
  config: ResolvedAdminConfig,
  req: Request,
  place?: RefusedPlace,
): Promise<React.ReactNode> {
  const { access, errors } = mergeLabels(config.labels);
  if (err instanceof FlowpanelRateLimitError) {
    return (
      <Wall
        title={access.rateLimitedTitle}
        description={access.rateLimitedDescription}
        actions={<RefreshButton label={errors.retry} />}
      />
    );
  }
  if (!(err instanceof FlowpanelAccessError) && !(err instanceof FlowpanelAuthError)) {
    throw err;
  }

  const session = await config.auth.session(req).catch(() => null);
  const isAuthError = err instanceof FlowpanelAuthError || session === null;
  const section = place && !isAuthError ? sectionLabel(config, place.slug) : null;
  if (place && section) return deniedSectionWall(config, place, section);
  const target = isAuthError ? config.auth.signInUrl : config.auth.forbiddenUrl;
  if (target) redirect(target);
  return isAuthError ? signInWall(config) : deniedWall(config);
}
