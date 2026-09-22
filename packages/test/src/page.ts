/**
 * The slice of Playwright's `Page` the walk actually drives. Narrowing it here
 * keeps the walker testable against a fake page, with one cast at the entry.
 */
export interface SmokeLocator {
  first(): SmokeLocator;
  nth(index: number): SmokeLocator;
  count(): Promise<number>;
  all(): Promise<SmokeLocator[]>;
  getAttribute(name: string): Promise<string | null>;
  click(options?: { timeout?: number }): Promise<void>;
  waitFor(options?: { state?: "visible"; timeout?: number }): Promise<void>;
}

export interface SmokeResponse {
  status(): number;
}

export interface SmokeConsoleMessage {
  type(): string;
  text(): string;
}

export interface SmokeCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  url?: string;
}

export interface SmokeContext {
  addCookies(cookies: SmokeCookie[]): Promise<void>;
}

export interface SmokePage {
  goto(url: string): Promise<SmokeResponse | null>;
  url(): string;
  locator(selector: string): SmokeLocator;
  context(): SmokeContext;
  on(event: "console", handler: (message: SmokeConsoleMessage) => void): void;
  waitForURL(predicate: (url: URL) => boolean, options?: { timeout?: number }): Promise<void>;
}
