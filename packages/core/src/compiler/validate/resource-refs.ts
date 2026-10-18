import { checkColumn, quoted } from "../../internal/validate-shared";
import { didYouMean } from "../../suggest";
import { FlowpanelConfigError } from "../../types/config-error";
import type { DashboardConfig } from "../../types/dashboard";
import type { ResourceConfig } from "../../types/resource";
import type { LinkCheck } from "./links";

interface RefSite {
  /** Resource name the config points at. */
  target: string;
  /** Human-readable config path, used verbatim in the error. */
  where: string;
  /** The target's column a reference labels its rows with. */
  labelField?: string;
}

function pushFieldRefs(list: unknown, where: string, out: RefSite[]): void {
  if (!Array.isArray(list)) return;
  list.forEach((entry, i) => {
    if (!entry || typeof entry !== "object") return;
    const ref = (entry as { reference?: { resource?: unknown; labelField?: unknown } }).reference;
    if (ref && typeof ref.resource === "string") {
      out.push({
        target: ref.resource,
        where: `${where}[${i}].reference.resource`,
        ...(typeof ref.labelField === "string" ? { labelField: ref.labelField } : {}),
      });
    }
  });
}

function pushWidgetRefs(widgets: unknown, where: string, out: RefSite[]): void {
  if (!Array.isArray(widgets)) return;
  widgets.forEach((w, i) => {
    if (!w || typeof w !== "object") return;
    const widget = w as { kind?: unknown; options?: { resource?: unknown } };
    if (widget.kind === "table" && typeof widget.options?.resource === "string") {
      out.push({ target: widget.options.resource, where: `${where}[${i}].resource` });
    }
  });
}

function pushTabRefs(tabs: unknown, where: string, out: RefSite[]): void {
  if (!Array.isArray(tabs)) return;
  tabs.forEach((t, i) => {
    if (!t || typeof t !== "object") return;
    const tab = t as { resource?: unknown; fields?: unknown; widgets?: unknown };
    if (typeof tab.resource === "string") {
      out.push({ target: tab.resource, where: `${where}[${i}].resource` });
    }
    pushFieldRefs(tab.fields, `${where}[${i}].fields`, out);
    pushWidgetRefs(tab.widgets, `${where}[${i}].widgets`, out);
  });
}

function resourceRefSites(resource: ResourceConfig): RefSite[] {
  const out: RefSite[] = [];
  const o = resource.options as {
    columns?: unknown;
    create?: { fields?: unknown };
    update?: { fields?: unknown };
    detail?: { fields?: unknown; tabs?: unknown; aside?: unknown };
    drawer?: { fields?: unknown; tabs?: unknown };
  };
  pushFieldRefs(o.columns, "columns", out);
  pushFieldRefs(o.create?.fields, "create.fields", out);
  pushFieldRefs(o.update?.fields, "update.fields", out);
  pushFieldRefs(o.detail?.fields, "detail.fields", out);
  pushTabRefs(o.detail?.tabs, "detail.tabs", out);
  pushWidgetRefs(o.detail?.aside, "detail.aside", out);
  pushFieldRefs(o.drawer?.fields, "drawer.fields", out);
  pushTabRefs(o.drawer?.tabs, "drawer.tabs", out);
  return out;
}

function assertKnown(sites: readonly RefSite[], owner: string, known: readonly string[]): void {
  for (const site of sites) {
    if (known.includes(site.target)) continue;
    throw new FlowpanelConfigError(
      `${owner} ${site.where}`,
      `it points at resource "${site.target}", which no registered resource is named.` +
        `${didYouMean(site.target, known)} Registered: ${quoted(known)}.`,
    );
  }
}

/** Throws when a config points at a resource name no registered resource resolves to. */
export function validateResourceRefs(
  resourcesByName: ReadonlyMap<string, ResourceConfig>,
  dashboards: readonly DashboardConfig[],
): void {
  const known = [...resourcesByName.keys()];
  for (const [name, r] of resourcesByName) {
    assertKnown(resourceRefSites(r), `resource "${name}"`, known);
  }
  for (const d of dashboards) {
    const sites: RefSite[] = [];
    (d.sections ?? []).forEach((s, i) => {
      pushWidgetRefs(s.widgets, `sections[${i}].widgets`, sites);
    });
    assertKnown(sites, `dashboard "${d.path}"`, known);
  }
}

/** Throws when a reference labels its rows with a column its target does not have. */
export function validateReferenceLabels(check: LinkCheck): void {
  for (const [name, resource] of check.resourcesByName) {
    for (const site of resourceRefSites(resource)) {
      if (site.labelField === undefined) continue;
      const where = `resource "${name}" ${site.where.replace(/\.resource$/, ".labelField")}`;
      checkColumn(where, site.target, site.labelField, check);
    }
  }
}
