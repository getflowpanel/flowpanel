import type { Page } from "@playwright/test";
import { createAxeScanner } from "./axe";
import type { SmokePage } from "./page";
import type { SmokeAdminOptions, SmokeAdminReport } from "./types";
import { runSmoke } from "./walk";

/**
 * Walk a FlowPanel admin the way an operator does — the sidebar, every
 * dashboard and list it links to, and the first row of each list — asserting
 * that nothing answers 4xx/5xx, writes to `console.error`, renders a FlowPanel
 * error surface, or (with `a11y`) breaks WCAG 2.2 AA.
 *
 * Resolves with the report on success and throws an `Error` carrying it
 * otherwise, so one `await smokeAdmin(page)` is a complete Playwright test.
 */
export async function smokeAdmin(
  page: Page,
  options: SmokeAdminOptions = {},
): Promise<SmokeAdminReport> {
  const scan = options.a11y ? await createAxeScanner(page) : null;
  return runSmoke(page as unknown as SmokePage, options, scan);
}
