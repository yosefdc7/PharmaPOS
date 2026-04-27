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

test("receipt preview after sale", async ({ page }) => {
  const firstProduct = page.getByRole("button", { name: /Paracetamol/i }).first();
  await expect(firstProduct).toBeVisible();
  await firstProduct.click();

  await expect(page.locator(".cart-line")).toBeVisible();

  const totalsSection = page.locator(".totals");
  const totalText = await totalsSection.locator(".grand").textContent();
  const totalValue = totalText?.replace(/[^0-9.]/g, "");

  await page.getByPlaceholder("Cash received").fill(totalValue || "100");

  await page.getByRole("button", { name: "Complete sale" }).click();

  await page.waitForTimeout(1000);

  const receiptDrawer = page.locator(".receipt-drawer");
  await expect(receiptDrawer).toBeVisible();

  const storeName = await receiptDrawer.getByRole("heading", { level: 2 }).textContent();
  expect(storeName).toBeTruthy();
  expect(storeName?.length).toBeGreaterThan(0);

  const orNumber = await receiptDrawer.locator("p").first().textContent();
  expect(orNumber).toBeTruthy();

  const receiptItems = receiptDrawer.locator(".receipt div");
  await expect(receiptItems.first()).toBeVisible();

  const totalLine = receiptDrawer.getByText(/Total/i);
  await expect(totalLine).toBeVisible();
});

test("reprint receipt", async ({ page }) => {
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

  // Close the receipt drawer if it's open
  const receiptDrawer = page.locator(".receipt-drawer");
  if (await receiptDrawer.isVisible()) {
    await receiptDrawer.getByRole("button", { name: "Close" }).click();
    await page.waitForTimeout(500);
  }

  await page.getByRole("button", { name: "Reprint Queue" }).click();

  const reprintHeading = page.getByRole("heading", { name: /Reprint Queue/i });
  await expect(reprintHeading).toBeVisible();
});
