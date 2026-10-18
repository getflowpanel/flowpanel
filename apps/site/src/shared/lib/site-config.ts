export const siteConfig = {
  name: "FlowPanel",
  seo: {
    title: "FlowPanel: a Next.js admin panel for Drizzle and Prisma",
    description:
      "Add an admin panel to your Next.js app: lists, forms, record pages and dashboards from your Drizzle or Prisma schema and a typed config. Open source, MIT.",
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
      (process.env.NODE_ENV === "development"
        ? "http://localhost:3100/admin"
        : "https://demo.flowpanel.tech/admin"),
  },

  examples: [
    {
      name: "examples/ai-scraper",
      url: "https://github.com/getflowpanel/flowpanel/tree/main/examples/ai-scraper",
    },
    {
      name: "examples/with-clerk",
      url: "https://github.com/getflowpanel/flowpanel/tree/main/examples/with-clerk",
    },
  ],
} as const;
