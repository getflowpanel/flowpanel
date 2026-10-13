import type { ResolvedAdminConfig } from "@flowpanel/core";
import {
  FlowpanelAccessError,
  FlowpanelAuthError,
  FlowpanelRateLimitError,
  formatLabel,
  mergeLabels,
} from "@flowpanel/core";
import { RefreshButton } from "@flowpanel/next/client";
import { Button, type NavGroup } from "@flowpanel/react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type * as React from "react";
import { Wall } from "../pages/wall";
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
  if (head === "queues" && key) return config.queuesByKey.get(key)?.options.label ?? null;
  const resource = head ? config.resourcesByName.get(head) : undefined;
  return resource && head ? pluralLabel(resource, head) : null;
}

/** The first nav entry that is not the refused page itself. */
function wayBack(place: RefusedPlace): { label: string; href: string } | null {
  for (const group of place.navGroups) {
    for (const item of group.items) {
      if (item.href !== place.currentPath) return { label: item.label, href: item.href };
    }
  }
  return null;
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
  const target = isAuthError ? config.auth.signInUrl : config.auth.forbiddenUrl;
  if (target) redirect(target);

  if (isAuthError) {
    const developing = process.env.NODE_ENV !== "production";
    if (developing) warnNoSession();
    return (
      <Wall
        title={access.signInTitle}
        description={access.signInDescription}
        actions={<RefreshButton label={access.reload} variant="outline" />}
      >
        {developing ? <DevAuthNote /> : null}
      </Wall>
    );
  }

  const section = place ? sectionLabel(config, place.slug) : null;
  if (place && section) {
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
