const CONFIG_ERROR = Symbol.for("flowpanel.configError");

/**
 * A config `defineAdmin` refuses to run, reported as `[flowpanel] <where in the config>: <what is wrong>. <how to fix>.`
 * `where` names the option, such as `resource "orders" drawer.tabs[0]`.
 */
export class FlowpanelConfigError extends Error {
  readonly where: string;

  /** Each entry point bundles its own copy of this class, so `instanceof` reads a shared brand. */
  static override [Symbol.hasInstance](value: unknown): boolean {
    return typeof value === "object" && value !== null && Reflect.get(value, CONFIG_ERROR) === true;
  }

  constructor(where: string, problem: string, options?: ErrorOptions) {
    super(`[flowpanel] ${where}: ${problem}`, options);
    this.name = "FlowpanelConfigError";
    this.where = where;
    Object.defineProperty(this, CONFIG_ERROR, { value: true });
  }
}
