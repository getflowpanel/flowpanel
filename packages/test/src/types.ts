/** One WCAG violation axe reported on a route the walk visited. */
export interface A11yViolation {
  route: string;
  id: string;
  impact?: string;
  /** CSS selectors of the first few failing elements, as axe reports them. */
  targets?: string[];
}

export interface SmokeA11yOptions {
  /** axe rule ids to skip, such as `"color-contrast"` while your own theme is being fixed. */
  disableRules?: string[];
}

export interface SmokeAdminOptions {
  /**
   * Where the admin is mounted: the config's `paths.admin`.
   * @defaultValue "/admin"
   */
  paths?: { admin?: string };
  /** Session cookie added before the walk, for an admin behind authentication. */
  cookie?: { name: string; value: string; domain?: string };
  /** Restrict the walk to these nav segments — `"customers"` for `/admin/customers`. Every entry visited when omitted. */
  resources?: string[];
  /**
   * Run axe against every visited route, leaving out iframes such as a queue's bull-board. Needs `@axe-core/playwright`; without it `smokeAdmin` fails and names the package.
   * Pass `{ disableRules: ["color-contrast"] }` to scan with every rule except those axe rule ids.
   * @defaultValue false
   */
  a11y?: boolean | SmokeA11yOptions;
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
