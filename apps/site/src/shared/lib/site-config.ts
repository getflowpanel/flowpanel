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
  },

  nav: {
    primary: [
      { label: "Docs", href: "/docs" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
} as const;

export type SiteConfig = typeof siteConfig;
