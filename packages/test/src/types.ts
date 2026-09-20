/** One WCAG violation axe reported on a route the walk visited. */
export interface A11yViolation {
  route: string;
  id: string;
  impact?: string;
}

export interface SmokeAdminOptions {
  /**
   * Where the admin is mounted, matching `createFlowpanel`'s `basePath`.
   * @defaultValue "/admin"
   */
  basePath?: string;
  /** Session cookie added before the walk, for an admin behind authentication. */
  cookie?: { name: string; value: string; domain?: string };
  /**
   * Restrict the walk to these nav segments — `"customers"` for
   * `/admin/customers`, `"/"` for the landing page. Every nav entry is visited
   * when this is omitted.
   */
  resources?: string[];
  /**
   * Run axe against every visited route. Needs `@axe-core/playwright`; the walk
   * skips the scan, rather than failing, when it does not resolve.
   * @defaultValue false
   */
  a11y?: boolean;
  /**
   * How many rows of each list the walk opens.
   * @defaultValue 1
   */
  maxRows?: number;
}

export interface SmokeAdminReport {
  /** Every route the walk loaded, in order, including rows it opened. */
  visited: string[];
  consoleErrors: string[];
  a11yViolations: A11yViolation[];
}
