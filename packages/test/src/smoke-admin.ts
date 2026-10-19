import type { Page } from "@playwright/test";
import { createAxeScanner } from "./axe";
import type { SmokePage } from "./page";
import type { SmokeAdminOptions, SmokeAdminReport } from "./types";
import { runSmoke } from "./walk";

/**
 * Walks a FlowPanel admin the way an operator does, asserting no 4xx/5xx, no `console.error`, no error surface.
 * Resolves with the report on success and throws an `Error` carrying it otherwise.
 */
export async function smokeAdmin(
  page: Page,
  options: SmokeAdminOptions = {},
): Promise<SmokeAdminReport> {
  const { a11y } = options;
  const scan = a11y ? await createAxeScanner(page, a11y === true ? {} : a11y) : null;
  return runSmoke(page as unknown as SmokePage, options, scan);
}
