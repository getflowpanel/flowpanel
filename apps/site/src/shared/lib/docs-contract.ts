export const DOC_KINDS = [
  "tutorial",
  "how-to",
  "explanation",
  "reference",
  "troubleshooting",
] as const;

export interface DocRedirect {
  source: "/docs" | `/docs/${string}`;
  destination: `/docs/${string}` | "/changelog";
  /** Section roots point at whichever page comes first, so browsers must not cache them. */
  permanent?: false;
}

export const DOC_REDIRECTS = [
  { source: "/docs", destination: "/docs/introduction/getting-started" },
  {
    source: "/docs/introduction",
    destination: "/docs/introduction/getting-started",
    permanent: false,
  },
  { source: "/docs/build", destination: "/docs/build/configuration", permanent: false },
  { source: "/docs/customization", destination: "/docs/customization/overview", permanent: false },
  { source: "/docs/guides", destination: "/docs/guides/production-readiness", permanent: false },
  {
    source: "/docs/understand",
    destination: "/docs/understand/how-flowpanel-works",
    permanent: false,
  },
  { source: "/docs/reference", destination: "/docs/reference/define-config", permanent: false },
  { source: "/docs/integrations/drizzle", destination: "/docs/introduction/drizzle" },
  { source: "/docs/integrations/prisma", destination: "/docs/introduction/prisma" },
  { source: "/docs/core-concepts/configuration", destination: "/docs/build/configuration" },
  { source: "/docs/core-concepts/resources", destination: "/docs/build/resources" },
  { source: "/docs/customization/forms", destination: "/docs/build/forms" },
  { source: "/docs/customization/import-export", destination: "/docs/build/import-export" },
  { source: "/docs/core-concepts/dashboards", destination: "/docs/build/dashboards" },
  { source: "/docs/core-concepts/styling", destination: "/docs/customization/styling" },
  { source: "/docs/core-concepts/adapters", destination: "/docs/understand/adapters" },
  { source: "/docs/core-concepts/permissions", destination: "/docs/guides/permissions" },
  { source: "/docs/core-concepts/queues", destination: "/docs/guides/queues" },
  { source: "/docs/core-concepts/realtime-multi-instance", destination: "/docs/guides/realtime" },
  { source: "/docs/guides/troubleshooting", destination: "/docs/troubleshooting" },
  { source: "/docs/guides/auth-with-clerk", destination: "/docs/guides/authentication" },
  { source: "/docs/guides/auth-with-better-auth", destination: "/docs/guides/authentication" },
  { source: "/docs/guides/realtime-with-redis", destination: "/docs/guides/realtime" },
  { source: "/docs/build/analytics", destination: "/docs/build/dashboards" },
  { source: "/docs/build/drawers", destination: "/docs/build/detail-cards" },
  { source: "/docs/customization/theme-slots", destination: "/docs/customization/styling" },
  {
    source: "/docs/introduction/project-structure",
    destination: "/docs/introduction/getting-started",
  },
  {
    source: "/docs/understand/request-lifecycle",
    destination: "/docs/understand/how-flowpanel-works",
  },
  {
    source: "/docs/understand/server-client-boundaries",
    destination: "/docs/understand/how-flowpanel-works",
  },
  { source: "/docs/understand/type-inference", destination: "/docs/reference/registry" },
] as const satisfies readonly DocRedirect[];

export function validateDocRedirects(
  redirects: readonly DocRedirect[],
  canonicalRoutes: ReadonlySet<string>,
): void {
  const destinations = new Map<string, string>();

  for (const redirect of redirects) {
    if (destinations.has(redirect.source)) {
      throw new Error(`Duplicate documentation redirect source: ${redirect.source}`);
    }
    destinations.set(redirect.source, redirect.destination);
  }

  for (const source of destinations.keys()) {
    const seen = new Set<string>();
    let route: string | undefined = source;

    while (route !== undefined && destinations.has(route)) {
      if (seen.has(route)) {
        throw new Error(`Documentation redirect loop starts at ${source}`);
      }
      seen.add(route);
      route = destinations.get(route);
    }
  }

  for (const redirect of redirects) {
    if (canonicalRoutes.has(redirect.source)) {
      throw new Error(`Documentation redirect hides a page: ${redirect.source}`);
    }
    if (destinations.has(redirect.destination)) {
      throw new Error(
        `Documentation redirect chain: ${redirect.source} points to ${redirect.destination}`,
      );
    }
    if (!canonicalRoutes.has(redirect.destination)) {
      throw new Error(`Documentation redirect has missing destination: ${redirect.destination}`);
    }
  }
}
