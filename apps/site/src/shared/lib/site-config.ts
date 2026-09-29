export const siteConfig = {
  name: "FlowPanel",
  seo: {
    title: "FlowPanel: a Next.js admin panel for Drizzle and Prisma",
    description:
      "Add a typed admin panel to your Next.js app from one config. CRUD, dashboards, BullMQ queues and realtime on top of your Drizzle or Prisma schema. Open source, MIT.",
  },
  url: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://flowpanel.tech",

  repo: {
    url: "https://github.com/getflowpanel/flowpanel",
    branch: "main",
  },

  links: {
    github: "https://github.com/getflowpanel/flowpanel",
    issues: "https://github.com/getflowpanel/flowpanel/issues",
    npm: "https://www.npmjs.com/package/@flowpanel/kit",
    // Hosted examples/ai-scraper; in development it expects the example on port 3100.
    demo:
      process.env.NEXT_PUBLIC_DEMO_URL?.trim() ||
      (process.env.NODE_ENV === "development" ? "http://localhost:3100/admin" : ""),
  },

  /** Runnable examples in the repo, surfaced from the landing page. */
  examples: [
    {
      name: "ai-scraper",
      summary:
        "An AI scraping SaaS ops admin: resources, dashboards, BullMQ queues and realtime, on Drizzle + Postgres.",
      url: "https://github.com/getflowpanel/flowpanel/tree/main/examples/ai-scraper",
      config:
        "https://github.com/getflowpanel/flowpanel/tree/main/examples/ai-scraper/src/admin/config",
      readme: "https://github.com/getflowpanel/flowpanel/tree/main/examples/ai-scraper#run-locally",
    },
    {
      name: "with-clerk",
      summary:
        "A minimal users/posts admin gated behind Clerk — middleware, provider, one line of config.",
      url: "https://github.com/getflowpanel/flowpanel/tree/main/examples/with-clerk",
      config:
        "https://github.com/getflowpanel/flowpanel/blob/main/examples/with-clerk/src/flowpanel.config.ts",
      readme: "https://github.com/getflowpanel/flowpanel/tree/main/examples/with-clerk#run-it",
    },
  ],
} as const;

export type SiteConfig = typeof siteConfig;
