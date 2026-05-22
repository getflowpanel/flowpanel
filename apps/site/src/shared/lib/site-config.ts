/**
 * Single source of truth for site-wide configuration:
 * repo URLs, social links, default copy. Imported by header, footer,
 * edit-on-GitHub links, OG image template, and sitemap.
 */
export const siteConfig = {
  name: "flowpanel",
  description: "The admin panel you don't have to build.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://flowpanel.dev",
  ogImage: "/og.png",

  repo: {
    owner: "Ch4m4",
    name: "flowpanel",
    url: "https://github.com/Ch4m4/flowpanel",
    // Branch + path where docs live, used for "Edit this page on GitHub".
    docsPath: "apps/site/content/docs",
    branch: "main",
  },

  links: {
    github: "https://github.com/Ch4m4/flowpanel",
    issues: "https://github.com/Ch4m4/flowpanel/issues",
    discussions: "https://github.com/Ch4m4/flowpanel/discussions",
    // Public read-only instance of `examples/freelance-radar`. DNS lands
    // here once the deployment is up. Until then the link 404s — owner
    // is aware. See examples/freelance-radar/README.md.
    demo: "https://demo.flowpanel.dev",
  },

  nav: {
    primary: [
      { label: "Docs", href: "/docs" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
} as const;

export type SiteConfig = typeof siteConfig;
