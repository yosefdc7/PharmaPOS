import { test, expect } from '@playwright/test';

test.describe.configure({ timeout: 120000 });

async function setupPage(page: any) {
  page.on('console', (msg: any) => {
    if (msg.type() === 'error') {
      console.log(`PAGE ERROR: ${msg.text()}`);
    }
  });
  await page.goto('http://localhost:3456/');
  await page.waitForSelector('.boot-screen', { state: 'detached', timeout: 90000 }).catch(async () => {
    console.log('Boot screen did not detach within 90s');
  });
  const loginCard = page.locator('.login-card');
  if (await loginCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    await loginCard.getByPlaceholder('Username').fill('admin');
    await loginCard.getByPlaceholder('Password').fill('admin');
    await loginCard.getByRole('button', { name: /Log in/i }).click();
    await page.waitForTimeout(2000);
  }
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 30000 });
}

test.describe('Desktop (1920x900)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 900 });
    await setupPage(page);
  });

  test('sidebar is visible by default', async ({ page }) => {
    const sideNav = page.locator('.side-nav');
    await expect(sideNav).toBeVisible();
    const boundingBox = await sideNav.boundingBox();
    expect(boundingBox?.width).toBeGreaterThan(200);
  });

  test('cart panel is inline (not fixed drawer)', async ({ page }) => {
    const cartPanel = page.locator('.cart-panel');
    await expect(cartPanel).toBeVisible();
    const styles = await cartPanel.evaluate((el: HTMLElement) => window.getComputedStyle(el).position);
    expect(styles).toBe('sticky');
  });

  test('cart FAB is hidden on desktop', async ({ page }) => {
    const cartFab = page.locator('.cart-fab');
    await expect(cartFab).not.toBeVisible();
  });

  test('sidebar backdrop is hidden', async ({ page }) => {
    const backdrop = page.locator('.side-nav-backdrop');
    await expect(backdrop).toBeHidden();
  });

  test('toolbar shows all controls inline', async ({ page }) => {
    await expect(page.getByPlaceholder('Search product, SKU, supplier')).toBeVisible();
    await expect(page.locator('.toolbar-filters').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reprint Queue' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Preview OR' })).toBeVisible();
    await expect(page.locator('.toolbar-filter-toggle')).not.toBeVisible();
  });
});

test.describe('Mobile (320x568)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await setupPage(page);
  });

  test('sidebar is visible by default', async ({ page }) => {
    const sideNav = page.locator('.side-nav');
    await expect(sideNav).toBeVisible();
    const boundingBox = await sideNav.boundingBox();
    expect(boundingBox?.width).toBeGreaterThan(100);
  });

  test('cart panel is hidden as fixed drawer', async ({ page }) => {
    const cartPanel = page.locator('.cart-panel');
    await expect(cartPanel).toBeVisible();
    const styles = await cartPanel.evaluate((el: HTMLElement) => window.getComputedStyle(el).position);
    expect(styles).toBe('fixed');
    const transform = await cartPanel.evaluate((el: HTMLElement) => window.getComputedStyle(el).transform);
    expect(transform).toContain('matrix');
  });

  test('cart FAB is visible', async ({ page }) => {
    const cartFab = page.locator('.cart-fab');
    await expect(cartFab).toBeVisible();
    await expect(cartFab).toHaveText('Cart');
  });

  test('clicking cart FAB opens drawer', async ({ page }) => {
    const cartFab = page.locator('.cart-fab');
    await cartFab.click();
    const cartPanel = page.locator('.cart-panel');
    await expect(cartPanel).toHaveClass(/open/);
    const overlay = page.locator('.cart-drawer-overlay');
    await expect(overlay).toBeVisible();
  });

  test('clicking drawer overlay closes cart drawer', async ({ page }) => {
    const cartFab = page.locator('.cart-fab');
    await cartFab.click();
    const overlay = page.locator('.cart-drawer-overlay');
    await expect(overlay).toBeVisible();
    await overlay.click();
    await page.waitForTimeout(400);
    const cartPanel = page.locator('.cart-panel');
    await expect(cartPanel).not.toHaveClass(/open/);
  });

  test('toolbar filter toggle is visible and functional', async ({ page }) => {
    const filterToggle = page.locator('.toolbar-filter-toggle');
    await expect(filterToggle).toBeVisible();
    const filters = page.locator('.toolbar-filters').first();
    await expect(filters).not.toBeVisible();
    await filterToggle.click();
    await expect(filters).toBeVisible();
    await filterToggle.click();
    await expect(filters).not.toBeVisible();
  });

  test('toolbar action buttons are hidden on mobile', async ({ page }) => {
    await expect(page.locator('.toolbar-actions').first()).not.toBeVisible();
  });

  test('product cards are single column', async ({ page }) => {
    const productGrid = page.locator('.product-grid').first();
    const styles = await productGrid.evaluate((el: HTMLElement) => window.getComputedStyle(el).gridTemplateColumns);
    expect(styles).not.toContain(' ');
  });

  test('topbar subtitle is hidden', async ({ page }) => {
    const topbarParagraph = page.locator('.topbar p').first();
    await expect(topbarParagraph).not.toBeVisible();
  });

  test('opening sidebar shows backdrop', async ({ page }) => {
    const navToggle = page.locator('.nav-toggle').first();
    await navToggle.click();
    const backdrop = page.locator('.side-nav-backdrop');
    await expect(backdrop).toBeVisible();
    await backdrop.click();
    await page.waitForTimeout(300);
    const sideNav = page.locator('.side-nav');
    const boundingBox = await sideNav.boundingBox();
    expect(boundingBox?.x).toBeLessThan(0);
  });

  test('touch targets meet minimum size', async ({ page }) => {
    const productCards = page.locator('.product-card');
    const firstCard = productCards.first();
    const box = await firstCard.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(48);
    const navButtons = page.locator('.side-nav nav button');
    if (await navButtons.count() > 0) {
      const firstNavBtn = navButtons.first();
      const navBox = await firstNavBtn.boundingBox();
      expect(navBox?.height).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('Tablet (768x1024)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await setupPage(page);
  });

  test('sidebar is visible by default', async ({ page }) => {
    const sideNav = page.locator('.side-nav');
    await expect(sideNav).toBeVisible();
    const boundingBox = await sideNav.boundingBox();
    expect(boundingBox?.width).toBeGreaterThan(100);
  });

  test('workspace has left margin from sidebar', async ({ page }) => {
    const workspace = page.locator('.workspace').first();
    const marginLeft = await workspace.evaluate((el: HTMLElement) => window.getComputedStyle(el).marginLeft);
    expect(parseFloat(marginLeft)).toBeGreaterThan(0);
  });

  test('cart panel is inline sticky', async ({ page }) => {
    const cartPanel = page.locator('.cart-panel');
    const styles = await cartPanel.evaluate((el: HTMLElement) => window.getComputedStyle(el).position);
    expect(styles).toBe('sticky');
  });

  test('product grid is two columns', async ({ page }) => {
    const productGrid = page.locator('.product-grid').first();
    const styles = await productGrid.evaluate((el: HTMLElement) => window.getComputedStyle(el).gridTemplateColumns);
    expect(styles).toContain(' ');
  });
});

test.describe('Mobile (480x850) - landscape phone', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 850 });
    await setupPage(page);
  });

  test('product grid is single column', async ({ page }) => {
    const productGrid = page.locator('.product-grid').first();
    const styles = await productGrid.evaluate((el: HTMLElement) => window.getComputedStyle(el).gridTemplateColumns);
    expect(styles).not.toContain(' ');
  });

  test('product cards are compact', async ({ page }) => {
    const chevrons = page.locator('.product-chevron');
    await expect(chevrons.first()).not.toBeVisible();
  });

  test('cart FAB is visible', async ({ page }) => {
    const cartFab = page.locator('.cart-fab');
    await expect(cartFab).toBeVisible();
  });
});

test.describe('Cross-breakpoint sidebar behavior', () => {
  test('sidebar closes when resizing from desktop to mobile', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 900 });
    await setupPage(page);
    const sideNav = page.locator('.side-nav');
    await expect(sideNav).toBeVisible();
    await page.setViewportSize({ width: 320, height: 568 });
    await page.waitForTimeout(500);
    const boundingBox = await sideNav.boundingBox();
    expect(boundingBox?.x).toBeLessThan(0);
  });
});


