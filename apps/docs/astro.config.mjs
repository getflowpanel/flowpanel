import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://flowpanel.dev",
  integrations: [
    starlight({
      title: "FlowPanel",
      description: "One typed config → full admin panel for Next.js. Drizzle or Prisma. Realtime. Queues. Eject when you outgrow it.",
      logo: {
        src: "./src/assets/logo.svg",
        replacesTitle: false,
      },
      social: {
        github: "https://github.com/Ch4m4/flowpanel",
      },
      editLink: {
        baseUrl: "https://github.com/Ch4m4/flowpanel/edit/main/apps/docs/",
      },
      sidebar: [
        { label: "Getting started", link: "/getting-started/" },
        {
          label: "Reference",
          items: [
            { label: "Resources", link: "/reference/resources/" },
            { label: "Dashboards", link: "/reference/dashboard/" },
            { label: "Actions", link: "/reference/actions/" },
            { label: "Realtime", link: "/reference/realtime/" },
            { label: "Queues", link: "/reference/queues/" },
            { label: "Theme", link: "/reference/theme/" },
            { label: "Handler", link: "/reference/handler/" },
            { label: "Adapters", link: "/reference/adapters/" },
            { label: "Errors", link: "/reference/errors/" },
            { label: "Metrics", link: "/reference/metrics/" },
          ],
        },
        {
          label: "Recipes",
          items: [
            { label: "File uploads", link: "/recipes/file-uploads/" },
            { label: "JSON editor", link: "/recipes/jsonb-editor/" },
            { label: "Multi-tenant", link: "/recipes/multi-tenant/" },
          ],
        },
      ],
      customCss: ["./src/styles/custom.css"],
      head: [
        {
          tag: "meta",
          attrs: { name: "theme-color", content: "#3b82f6" },
        },
      ],
    }),
  ],
});
