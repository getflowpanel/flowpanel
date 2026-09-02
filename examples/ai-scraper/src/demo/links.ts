const REPO = "https://github.com/getflowpanel/flowpanel";
const SOURCE = `${REPO}/tree/main/examples/ai-scraper`;

export const demoLinks = {
  site: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://flowpanel.tech",
  repo: REPO,
  source: SOURCE,
  config: `${SOURCE}/src/admin/config`,
};
