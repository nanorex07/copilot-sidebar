import { test, expect } from '@playwright/test';

test.describe('Copilot Sidebar UI', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Vite dev server
    await page.goto('/');
  });

  test('should display the app header with title', async ({ page }) => {
    // Check if the Copilot Sidebar heading is visible
    await expect(page.locator('h1')).toContainText('Copilot Sidebar');
  });

  test('should default to the Ask tab', async ({ page }) => {
    // Or we can just check if the tab-item for Ask has the 'active' class
    const askTab = page.locator('.tab-item', { hasText: 'Ask' });
    await expect(askTab).toHaveClass(/active/);
  });

  test('should navigate to Settings tab', async ({ page }) => {
    const settingsTab = page.locator('.tab-item', { hasText: 'Settings' });
    await settingsTab.click();

    await expect(settingsTab).toHaveClass(/active/);
    await expect(page.locator('.section-title', { hasText: 'OPENAI CONFIGURATION' })).toBeVisible();
  });

  test('should navigate to Config tab', async ({ page }) => {
    const configTab = page.locator('.tab-item', { hasText: 'Config' });
    await configTab.click();

    await expect(configTab).toHaveClass(/active/);
    // Config view should have "Agent Loop Limits" or similar text
    await expect(page.locator('text=Agent Loop Limits').first()).toBeVisible();
  });
});
