import { expect, test } from "@playwright/test";

test.describe("Home page visual", () => {
  test("full page screenshot", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveScreenshot("home-full.png", { fullPage: true });
  });

  test("desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await expect(page).toHaveScreenshot("home-desktop.png");
  });

  test("mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await expect(page).toHaveScreenshot("home-mobile.png");
  });
});
