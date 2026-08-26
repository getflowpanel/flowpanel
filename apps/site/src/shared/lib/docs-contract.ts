export const DOC_KINDS = [
  "tutorial",
  "how-to",
  "explanation",
  "reference",
  "troubleshooting",
] as const;

export type DocKind = (typeof DOC_KINDS)[number];

export interface DocRedirect {
  source: "/docs" | `/docs/${string}`;
  destination: `/docs/${string}`;
}

export const DOC_REDIRECTS = [
  { source: "/docs", destination: "/docs/introduction/getting-started" },
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
