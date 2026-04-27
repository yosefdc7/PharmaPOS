import { test, expect } from "@playwright/test";

test.describe.configure({ timeout: 120000 });

test.beforeEach(async ({ page }) => {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`PAGE ERROR: ${msg.text()}`);
    }
  });

  await page.goto("/");
  await page.waitForSelector(".boot-screen", { state: "detached", timeout: 90000 }).catch(async () => {
    console.log("Boot screen did not detach within 90s, checking page state...");
  });

  const loginCard = page.locator(".login-card");
  if (await loginCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    await loginCard.getByPlaceholder("Username").fill("admin");
    await loginCard.getByPlaceholder("Password").fill("admin");
    await loginCard.getByRole("button", { name: /Log in/i }).click();
    await page.waitForTimeout(2000);
  }

  await expect(page.locator(".app-shell")).toBeVisible({ timeout: 30000 });
});

test("switch between POS views", async ({ page }) => {
  const sideNav = page.locator(".side-nav");

  // Click Products and wait for Inventory heading
  await sideNav.getByRole("button", { name: "Products" }).click();
  await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible({ timeout: 15000 });

  // Click Customers and wait for Customers heading
  await sideNav.getByRole("button", { name: "Customers" }).click();
  await expect(page.locator("h2", { hasText: "Customers" })).toBeVisible({ timeout: 15000 });

  // Click Reports and wait for Reports heading
  await sideNav.getByRole("button", { name: "Reports" }).click();
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible({ timeout: 15000 });

  // Click Settings and wait for Settings heading
  await sideNav.getByRole("button", { name: "Settings" }).click();
  await expect(page.locator("h2", { hasText: "Settings" })).toBeVisible({ timeout: 15000 });
});

test("reports overview shows daily sales", async ({ page }) => {
  const firstProduct = page.getByRole("button", { name: /Paracetamol/i }).first();
  await expect(firstProduct).toBeVisible();
  await firstProduct.click();

  await expect(page.locator(".cart-line")).toBeVisible();

  const totalsSection = page.locator(".totals");
  const totalText = await totalsSection.locator(".grand").textContent();
  const totalValue = totalText?.replace(/[^0-9.]/g, "");

  await page.getByPlaceholder("Cash received").fill(totalValue || "100");

  await page.getByRole("button", { name: "Complete sale" }).click();

  await page.waitForTimeout(2000);

  // Close receipt drawer if open
  const receiptDrawer = page.locator(".receipt-drawer");
  if (await receiptDrawer.isVisible()) {
    await receiptDrawer.getByRole("button", { name: "Close" }).click();
    await page.waitForTimeout(500);
  }

  const sideNav = page.locator(".side-nav");
  await sideNav.getByRole("button", { name: "Reports" }).click();

  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();

  await page.getByRole("button", { name: "Overview" }).click();

  const todaySalesMetric = page.getByText(/Today/i);
  await expect(todaySalesMetric).toBeVisible();

  const transactionCount = page.locator(".metric").filter({ hasText: "Transactions" });
  await expect(transactionCount).toBeVisible();

  const summaryPanel = page.locator(".metric").filter({ hasText: "Total sales" });
  await expect(summaryPanel).toBeVisible();
});
