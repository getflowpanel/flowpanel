/**
 * Single source of truth for site-wide configuration:
 * repo URLs, social links, default copy. Imported by header, footer,
 * edit-on-GitHub links, OG image template, and sitemap.
 */
export const siteConfig = {
  name: "flowpanel",
  description: "The admin panel you don't have to build.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://flowpanel.tech",
  ogImage: "/og.png",

  repo: {
    owner: "getflowpanel",
    name: "flowpanel",
    url: "https://github.com/getflowpanel/flowpanel",
    // Branch + path where docs live, used for "Edit this page on GitHub".
    docsPath: "apps/site/content/docs",
    branch: "main",
  },

  links: {
    github: "https://github.com/getflowpanel/flowpanel",
    issues: "https://github.com/getflowpanel/flowpanel/issues",
    discussions: "https://github.com/getflowpanel/flowpanel/discussions",
    // Hosted demo of examples/ai-scraper. Local development points at the
    // canonical showcase automatically; deployments provide their public URL.
    demo:
      process.env.NEXT_PUBLIC_DEMO_URL?.trim() ||
      (process.env.NODE_ENV === "development" ? "http://localhost:3000/admin" : ""),
  },

  /** Runnable examples in the repo, surfaced from the landing page. */
  examples: [
    {
      name: "ai-scraper",
      summary:
        "An AI scraping SaaS ops admin: resources, dashboards, BullMQ queues and realtime, on Drizzle + Postgres.",
      url: "https://github.com/getflowpanel/flowpanel/tree/main/examples/ai-scraper",
    },
    {
      name: "with-clerk",
      summary:
        "A minimal users/posts admin gated behind Clerk — middleware, provider, one line of config.",
      url: "https://github.com/getflowpanel/flowpanel/tree/main/examples/with-clerk",
    },
  ],

  nav: {
    primary: [
      { label: "Docs", href: "/docs" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
} as const;

export type SiteConfig = typeof siteConfig;
