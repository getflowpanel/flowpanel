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
  /** Restrict the walk to these nav segments — `"customers"` for `/admin/customers`. Every entry visited when omitted. */
  resources?: string[];
  /**
   * Run axe against every visited route; needs `@axe-core/playwright`, or the walk skips the scan instead of failing.
   * @defaultValue false
   */
  a11y?: boolean;
  /**
   * How many rows of each list the walk opens.
   * @defaultValue 1
   */
  maxRows?: number;
  /**
   * On each record page, open every other detail tab as `?tab=<key>` and check it the same way.
   * @defaultValue true
   */
  tabs?: boolean;
}

export interface SmokeAdminReport {
  /** Every route the walk loaded, in order, including rows it opened. */
  visited: string[];
  consoleErrors: string[];
  a11yViolations: A11yViolation[];
}
