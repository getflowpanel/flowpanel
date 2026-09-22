import type { SmokeLocator, SmokePage } from "./page";
import type { A11yViolation, SmokeAdminOptions, SmokeAdminReport } from "./types";

const NAV = "nav[data-flowpanel-nav]";
const MAIN = "main";
const ERROR_SURFACE = "[data-fp-error]";
const ROWS = "main table tbody tr";
const DIALOG = '[role="dialog"]';
const ACTIVATION_TIMEOUT = 5_000;

/** One axe finding before the walk attributes it to a route. */
export type A11yFinding = Omit<A11yViolation, "route">;

export type A11yScanner = () => Promise<A11yFinding[]>;

interface Walk {
  page: SmokePage;
  basePath: string;
  scan: A11yScanner | null;
  report: SmokeAdminReport;
  failures: string[];
}

export function normalizeBasePath(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (trimmed === "") return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/** A nav href, as a route on this origin. Anything that leaves the origin is skipped. */
function sameOriginRoute(href: string, origin: string): string | null {
  try {
    const url = new URL(href, origin);
    return url.origin === origin ? `${url.pathname}${url.search}` : null;
  } catch {
    return null;
  }
}

function currentRoute(page: SmokePage): string {
  const url = new URL(page.url());
  return `${url.pathname}${url.search}`;
}

/** `/admin` and `/admin/orders` are under the admin; `/administrators` is not. */
export function isUnderBasePath(route: string, basePath: string): boolean {
  if (basePath === "/") return route.startsWith("/");
  const path = route.split("?")[0] ?? "";
  return path === basePath || path.startsWith(`${basePath}/`);
}

function segmentOf(route: string, basePath: string): string {
  const rest = route.slice(basePath === "/" ? 0 : basePath.length).split("?")[0] ?? "";
  const segment = rest.replace(/^\/+/, "").split("/")[0] ?? "";
  return segment === "" ? "/" : segment;
}

async function navRoutes(walk: Walk, resources: string[] | undefined): Promise<string[]> {
  const origin = new URL(walk.page.url()).origin;
  const routes: string[] = [];
  for (const link of await walk.page.locator(`${NAV} a`).all()) {
    const href = await link.getAttribute("href");
    const route = href === null ? null : sameOriginRoute(href, origin);
    if (route === null || !isUnderBasePath(route, walk.basePath)) continue;
    if (routes.includes(route)) continue;
    if (resources && !resources.includes(segmentOf(route, walk.basePath))) continue;
    routes.push(route);
  }
  return routes;
}

async function inspect(walk: Walk, route: string): Promise<void> {
  walk.report.visited.push(route);
  await walk.page.locator(MAIN).first().waitFor({ state: "visible" });
  if ((await walk.page.locator(ERROR_SURFACE).count()) > 0) {
    walk.failures.push(`${route}: rendered a FlowPanel error surface`);
  }
  if (!walk.scan) return;
  for (const found of await walk.scan()) walk.report.a11yViolations.push({ ...found, route });
}

async function open(walk: Walk, route: string): Promise<void> {
  const status = (await walk.page.goto(route))?.status();
  if (status !== undefined && status >= 400) walk.failures.push(`${route}: responded ${status}`);
  await inspect(walk, route);
}

/** A row acts by navigating to its page or by opening the drawer; both count. */
async function activate(walk: Walk, row: SmokeLocator, from: string): Promise<boolean> {
  await row.click({ timeout: ACTIVATION_TIMEOUT });
  try {
    await walk.page.waitForURL((url) => `${url.pathname}${url.search}` !== from, {
      timeout: ACTIVATION_TIMEOUT,
    });
    return true;
  } catch {
    return (await walk.page.locator(DIALOG).count()) > 0;
  }
}

async function openRows(walk: Walk, route: string, maxRows: number): Promise<void> {
  for (let index = 0; index < maxRows; index += 1) {
    if (index > 0) await open(walk, route);
    const rows = walk.page.locator(ROWS);
    if ((await rows.count()) <= index) return;
    if (!(await activate(walk, rows.nth(index), route))) return;
    await open(walk, currentRoute(walk.page));
  }
}

/** A walk that found nothing to walk is the failure it looks most like a pass. */
export function noNavigation(basePath: string): string {
  return `smokeAdmin found no navigation under ${basePath} — is the admin mounted there, and is the session signed in?`;
}

export function smokeFailure(report: SmokeAdminReport, failures: string[]): Error {
  const lines = [
    ...failures,
    ...report.consoleErrors.map((text) => `console.error: ${text}`),
    ...report.a11yViolations.map((v) => `${v.route}: axe ${v.id} (${v.impact ?? "unknown"})`),
  ];
  const detail = JSON.stringify(report, null, 2);
  return new Error(
    `smokeAdmin found ${lines.length} problem(s):\n${lines.join("\n")}\n\n${detail}`,
  );
}

/**
 * The session has to be there before the first page the walk inspects, or the
 * report describes the sign-in screen: its console errors and its axe violations
 * would be attributed to the admin. Without an explicit `domain` the cookie needs
 * an origin, so the walk loads `basePath` once without looking at it.
 */
async function applyCookie(
  page: SmokePage,
  basePath: string,
  cookie: NonNullable<SmokeAdminOptions["cookie"]>,
): Promise<void> {
  const { name, value, domain } = cookie;
  if (domain) {
    await page.context().addCookies([{ name, value, domain, path: "/" }]);
    return;
  }
  await page.goto(basePath);
  await page.context().addCookies([{ name, value, url: new URL(page.url()).origin }]);
}

export async function runSmoke(
  page: SmokePage,
  options: SmokeAdminOptions,
  scan: A11yScanner | null,
): Promise<SmokeAdminReport> {
  const report: SmokeAdminReport = { visited: [], consoleErrors: [], a11yViolations: [] };
  const failures: string[] = [];
  const basePath = normalizeBasePath(options.basePath ?? "/admin");
  const walk: Walk = { page, basePath, scan, report, failures };
  const maxRows = Math.max(0, options.maxRows ?? 1);

  if (options.cookie) await applyCookie(page, basePath, options.cookie);
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });

  await open(walk, basePath);
  const routes = await navRoutes(walk, options.resources);
  if (routes.length === 0) failures.push(noNavigation(basePath));

  for (const route of routes) {
    if (route !== basePath) await open(walk, route);
    await openRows(walk, route, maxRows);
  }

  if (failures.length + report.consoleErrors.length + report.a11yViolations.length > 0) {
    throw smokeFailure(report, failures);
  }
  return report;
}
