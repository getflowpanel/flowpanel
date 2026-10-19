import type {
  SmokeConsoleMessage,
  SmokeContext,
  SmokeCookie,
  SmokeLocator,
  SmokePage,
  SmokeResponse,
} from "../page";
import { element, type FakeNode, query } from "./fake-dom";

export interface FakeRoute {
  status?: number;
  navLinks?: string[];
  /** `false` renders the nav without `data-flowpanel-nav`, as an untagged shell would. */
  taggedNav?: boolean;
  rows?: number;
  errorSurface?: boolean;
  dialog?: boolean;
  /** Where activating row `n` takes the page. Absent rows stay inert. */
  rowTargets?: string[];
  consoleErrors?: string[];
  /** Replaces the generated document entirely. */
  dom?: FakeNode[];
  /** What this route serves once a cookie has been added — the signed-in page. */
  signedIn?: FakeRoute;
  /** Detail tab keys, rendered as `[data-fp-tab]` triggers inside `main`; the first is open. */
  tabs?: string[];
  /** Next's own error document with this text, in place of the admin. */
  crash?: string;
  /** Renders no `main`, as a page stuck before its shell would. */
  noMain?: boolean;
  /** Renders the rows as phone cards instead of a table. */
  cards?: boolean;
  /** The response body, as the server sent it. */
  body?: string;
}

const ORIGIN = "http://localhost:3000";

function documentOf(route: FakeRoute): FakeNode[] {
  if (route.dom) return route.dom;
  if (route.crash !== undefined) {
    return [element("html", { id: "__next_error__", "data-text": route.crash })];
  }
  const nodes: FakeNode[] = [];
  if (route.navLinks) {
    const links = route.navLinks.map((href) => element("a", { href }));
    const attrs = route.taggedNav === false ? {} : { "data-flowpanel-nav": "" };
    nodes.push(element("nav", { "aria-label": "Admin", ...attrs }, links));
  }
  const main: FakeNode[] = [];
  if (route.rows !== undefined && route.cards) {
    const cards = Array.from({ length: route.rows }, () =>
      element("li", { "data-fp-card": "" }, [element("button", { "data-fp-card-link": "" })]),
    );
    main.push(element("ul", {}, cards));
  } else if (route.rows !== undefined) {
    const rows = Array.from({ length: route.rows }, () => element("tr", { "data-fp-row": "" }));
    main.push(element("table", {}, [element("tbody", { tabindex: "0" }, rows)]));
  }
  if (route.errorSurface) main.push(element("div", { "data-fp-error": "" }));
  for (const [index, key] of (route.tabs ?? []).entries()) {
    main.push(
      element("button", { "data-fp-tab": key, "data-state": index === 0 ? "active" : "inactive" }),
    );
  }
  if (!route.noMain) nodes.push(element("main", { id: "main" }, main));
  if (route.dialog) nodes.push(element("div", { role: "dialog" }));
  return nodes;
}

class FakeLocator implements SmokeLocator {
  constructor(
    private readonly page: FakePage,
    private readonly selector: string,
    private readonly index = 0,
  ) {}

  first(): SmokeLocator {
    return new FakeLocator(this.page, this.selector, 0);
  }

  nth(index: number): SmokeLocator {
    return new FakeLocator(this.page, this.selector, index);
  }

  async count(): Promise<number> {
    return this.page.query(this.selector).length;
  }

  async all(): Promise<SmokeLocator[]> {
    return this.page
      .query(this.selector)
      .map((_, index) => new FakeLocator(this.page, this.selector, index));
  }

  async getAttribute(name: string): Promise<string | null> {
    return this.page.query(this.selector)[this.index]?.attrs?.[name] ?? null;
  }

  async isVisible(): Promise<boolean> {
    return this.page.query(this.selector).length > this.index;
  }

  async innerText(): Promise<string> {
    return this.page.query(this.selector)[this.index]?.attrs?.["data-text"] ?? "";
  }

  async press(): Promise<void> {
    const node = this.page.query(this.selector)[this.index];
    if (!node) throw new Error(`fake page: nothing matches ${this.selector}`);
    this.page.activateRow(this.index);
  }

  async waitFor(): Promise<void> {
    if (this.page.query(this.selector).length === 0) {
      throw new Error(`fake page: timed out waiting for ${this.selector}`);
    }
    this.page.waited.push(this.selector);
  }
}

export class FakePage implements SmokePage {
  readonly loads: string[] = [];
  readonly waited: string[] = [];
  readonly cookies: SmokeCookie[] = [];
  private route: string;
  private readonly handlers: Array<(message: SmokeConsoleMessage) => void> = [];

  constructor(
    private readonly routes: Record<string, FakeRoute>,
    start = "about:blank",
  ) {
    this.route = start;
  }

  current(): FakeRoute {
    const route = this.routes[this.route] ?? {};
    return route.signedIn && this.cookies.length > 0 ? route.signedIn : route;
  }

  query(selector: string): FakeNode[] {
    return query(documentOf(this.current()), selector);
  }

  activateRow(index: number): void {
    const target = this.current().rowTargets?.[index];
    if (target) this.route = target;
  }

  async goto(url: string): Promise<SmokeResponse | null> {
    this.route = url;
    this.loads.push(url);
    for (const text of this.current().consoleErrors ?? []) {
      for (const handler of this.handlers) handler({ type: () => "error", text: () => text });
    }
    const status = this.current().status ?? 200;
    const body = this.current().body ?? "";
    return { status: () => status, text: async () => body };
  }

  url(): string {
    return this.route.startsWith("http") ? this.route : `${ORIGIN}${this.route}`;
  }

  locator(selector: string): SmokeLocator {
    return new FakeLocator(this, selector);
  }

  context(): SmokeContext {
    return {
      addCookies: async (cookies) => {
        this.cookies.push(...cookies);
      },
    };
  }

  on(_event: "console", handler: (message: SmokeConsoleMessage) => void): void {
    this.handlers.push(handler);
  }

  async waitForURL(predicate: (url: URL) => boolean): Promise<void> {
    if (!predicate(new URL(this.url()))) throw new Error("url did not change");
  }
}
