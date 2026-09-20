import type { Page } from "@playwright/test";
import type { A11yScanner } from "./walk";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

interface AxeResults {
  violations: Array<{ id: string; impact?: string | null }>;
}

interface AxeRun {
  withTags(tags: string[]): AxeRun;
  analyze(): Promise<AxeResults>;
}

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
 * `@axe-core/playwright` is an optional peer: a project that has not installed
 * it gets the walk without the scan rather than a resolution failure.
 */
export async function createAxeScanner(page: Page): Promise<A11yScanner | null> {
  const AxeBuilder = await loadAxeBuilder();
  if (!AxeBuilder) return null;
  return async () => {
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    return violations.map((violation) => ({
      id: violation.id,
      ...(violation.impact ? { impact: violation.impact } : {}),
    }));
  };
}
