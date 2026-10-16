import type { Page } from "@playwright/test";
import type { A11yScanner } from "./walk";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

interface AxeResults {
  violations: Array<{
    id: string;
    impact?: string | null;
    nodes?: Array<{ target?: unknown[] }>;
  }>;
}

interface AxeRun {
  withTags(tags: string[]): AxeRun;
  exclude(selector: string): AxeRun;
  analyze(): Promise<AxeResults>;
}

const MAX_TARGETS = 5;

type AxeBuilderCtor = new (options: { page: Page }) => AxeRun;

function ctorOf(loaded: unknown): AxeBuilderCtor | null {
  const exported = (loaded as { default?: unknown })?.default ?? loaded;
  return typeof exported === "function" ? (exported as AxeBuilderCtor) : null;
}

async function loadAxeBuilder(): Promise<AxeBuilderCtor | null> {
  try {
    return ctorOf(await import("@axe-core/playwright"));
  } catch {
    return null;
  }
}

/**
 * Third-party frames, such as a queue's bull-board, are left out: their markup is not the admin's to fix.
 * `@axe-core/playwright` is an optional peer, needed only for `a11y: true`. Asking for the scan
 * without it fails, so a project that forgot the install never reads a pass it did not earn.
 */
export async function createAxeScanner(page: Page): Promise<A11yScanner> {
  const AxeBuilder = await loadAxeBuilder();
  if (!AxeBuilder) {
    throw new Error(
      "smokeAdmin: a11y: true needs @axe-core/playwright. Install it as a dev dependency, " +
        "or drop a11y.",
    );
  }
  return async () => {
    const { violations } = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .exclude("iframe")
      .analyze();
    return violations.map((violation) => {
      const targets = (violation.nodes ?? [])
        .slice(0, MAX_TARGETS)
        .map((node) => (node.target ?? []).map(String).join(" "));
      return {
        id: violation.id,
        ...(violation.impact ? { impact: violation.impact } : {}),
        ...(targets.length > 0 ? { targets } : {}),
      };
    });
  };
}
