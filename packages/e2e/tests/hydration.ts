import { test as base, expect, type Page } from "@playwright/test";

/** Resolves once React has attached its handlers to the admin root, so a press on a client-only trigger is not lost. */
export async function adminHydrated(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = document.querySelector("[data-flowpanel-root]");
    return root === null || Object.keys(root).some((key) => key.startsWith("__reactProps"));
  });
}

/** `page.goto` and `page.reload` that also wait for the admin to hydrate. */
export function hydrating(page: Page): Page {
  const goto = page.goto.bind(page);
  const reload = page.reload.bind(page);
  page.goto = async (url, options) => {
    const response = await goto(url, options);
    await adminHydrated(page);
    return response;
  };
  page.reload = async (options) => {
    const response = await reload(options);
    await adminHydrated(page);
    return response;
  };
  return page;
}

/** Plays a demo persona: the button posts a form and the server redirects to the admin with the new role set. */
export async function choosePersona(page: Page, role: "admin" | "support"): Promise<void> {
  const button = page.getByRole("button", { name: role, exact: true });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await adminHydrated(page);
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await use(hydrating(page));
  },
});

export type { Page } from "@playwright/test";
export { expect };
