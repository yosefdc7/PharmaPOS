import { test, expect } from "@playwright/test";

test.describe.configure({ timeout: 120000 });

test.beforeEach(async ({ page }) => {
  // Listen for console errors
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`PAGE ERROR: ${msg.text()}`);
    }
  });

  await page.goto("/");

  // Wait for boot screen to disappear (with longer timeout)
  await page.waitForSelector(".boot-screen", { state: "detached", timeout: 90000 }).catch(async () => {
    console.log("Boot screen did not detach within 90s, checking page state...");
  });

  // If login form appears, fill it
  const loginCard = page.locator(".login-card");
  if (await loginCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    await loginCard.getByPlaceholder("Username").fill("admin");
    await loginCard.getByPlaceholder("Password").fill("admin");
    await loginCard.getByRole("button", { name: /Log in/i }).click();
    await page.waitForTimeout(2000);
  }

  // Wait for app shell
  await expect(page.locator(".app-shell")).toBeVisible({ timeout: 30000 });
});

test("search and add product to cart", async ({ page }) => {
  await page.getByPlaceholder("Search product, SKU, supplier").fill("Paracetamol");

  const firstProduct = page.getByRole("button", { name: /Paracetamol/i }).first();
  await expect(firstProduct).toBeVisible();
  await firstProduct.click();

  await expect(page.getByText("Current Sale")).toBeVisible();
  await expect(page.getByRole("strong").filter({ hasText: /^1$/ })).toBeVisible();

  const totalsSection = page.locator(".totals");
  await expect(totalsSection.getByText("Items")).toBeVisible();
  await expect(totalsSection.locator("strong").first()).toHaveText("1");
});

test("update cart quantity", async ({ page }) => {
  const firstProduct = page.getByRole("button", { name: /Paracetamol/i }).first();
  await expect(firstProduct).toBeVisible();
  await firstProduct.click();

  await expect(page.locator(".cart-line").first()).toBeVisible();

  const qtyInput = page.locator(".cart-line").first().locator('input[type="number"], input:not([type])');
  await qtyInput.fill("3");

  await page.waitForTimeout(500);

  const cartLine = page.locator(".cart-line").first();
  const lineTotalText = await cartLine.locator("span").last().textContent();
  expect(lineTotalText).toBeTruthy();

  const totalsSection = page.locator(".totals");
  const itemCountEl = totalsSection.locator("strong").first();
  await expect(itemCountEl).toHaveText("3");
});

test("complete cash sale", async ({ page }) => {
  const firstProduct = page.getByRole("button", { name: /Paracetamol/i }).first();
  await expect(firstProduct).toBeVisible();
  await firstProduct.click();

  await expect(page.locator(".cart-line")).toBeVisible();

  const totalsSection = page.locator(".totals");
  const totalText = await totalsSection.locator(".grand").textContent();
  const totalValue = totalText?.replace(/[^0-9.]/g, "");

  await page.getByPlaceholder("Cash received").fill(totalValue || "100");

  await page.getByRole("button", { name: "Complete sale" }).click();

  // Wait for cart to clear and receipt to appear
  await page.waitForTimeout(2000);

  const receiptDrawer = page.locator(".receipt-drawer");
  await expect(receiptDrawer).toBeVisible({ timeout: 10000 });

  await expect(receiptDrawer.getByRole("heading", { level: 2 })).toBeVisible();

  // Cart should be empty after sale
  const cartLines = page.locator(".cart-line");
  await expect(cartLines).toHaveCount(0);
});

test("complete external terminal sale", async ({ page }) => {
  const firstProduct = page.getByRole("button", { name: /Paracetamol/i }).first();
  await expect(firstProduct).toBeVisible();
  await firstProduct.click();

  await expect(page.locator(".cart-line")).toBeVisible();

  await page.getByRole("button", { name: "External terminal" }).click();

  await page.getByPlaceholder("Terminal reference").fill("TXN-12345");

  await page.getByRole("button", { name: "Complete sale" }).click();

  await page.waitForTimeout(2000);

  const receiptDrawer = page.locator(".receipt-drawer");
  await expect(receiptDrawer).toBeVisible({ timeout: 10000 });

  const cartLines = page.locator(".cart-line");
  await expect(cartLines).toHaveCount(0);
});

test("hold and resume order", async ({ page }) => {
  const firstProduct = page.getByRole("button", { name: /Paracetamol/i }).first();
  await expect(firstProduct).toBeVisible();
  await firstProduct.click();

  await expect(page.locator(".cart-line")).toBeVisible();

  await page.getByPlaceholder("Hold reference").fill("HOLD-TEST-001");

  await page.getByRole("button", { name: "Hold order" }).click();

  await page.waitForTimeout(500);

  const cartLines = page.locator(".cart-line");
  await expect(cartLines).toHaveCount(0);

  const heldOrderBtn = page.getByRole("button", { name: /HOLD-TEST-001/i });
  await expect(heldOrderBtn).toBeVisible();
  await heldOrderBtn.click();

  await page.waitForTimeout(500);

  await expect(page.locator(".cart-line")).toBeVisible();

  const holdInput = page.getByPlaceholder("Hold reference");
  await expect(holdInput).toHaveValue("");
});
