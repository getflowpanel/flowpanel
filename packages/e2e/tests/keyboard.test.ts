import { expect, test } from "@playwright/test";

test.describe("keyboard shortcuts", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/admin");
		await page.waitForSelector("[data-testid='fp-root']");
		// Click body to ensure page has focus
		await page.click("body");
	});

	test("Cmd+K opens command palette", async ({ page }) => {
		await page.keyboard.press("Meta+k");
		await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
	});

	test("Esc closes command palette", async ({ page }) => {
		await page.keyboard.press("Meta+k");
		await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(page.getByRole("dialog", { name: "Command palette" })).not.toBeVisible();
	});

	test("key 2 switches to Users tab", async ({ page }) => {
		await page.keyboard.press("2");
		await expect(page.getByRole("tab", { name: "Users" })).toHaveAttribute("aria-selected", "true");
	});

	test("key 1 switches back to Pipeline tab", async ({ page }) => {
		await page.keyboard.press("2");
		await page.keyboard.press("1");
		await expect(page.getByRole("tab", { name: "Pipeline" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
	});

	test("command palette filters commands", async ({ page }) => {
		await page.keyboard.press("Meta+k");
		await page.keyboard.type("24");
		await expect(page.getByRole("option", { name: /24h/ })).toBeVisible();
	});
});
