import { test, expect } from '@playwright/test';

test.describe('Settings Page & Storage', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('should save and persist OpenAI configuration', async ({ page }) => {
    // Navigate to Settings tab
    await page.locator('.tab-item', { hasText: 'Settings' }).click();
    
    // Ensure we are on the Settings page
    await expect(page.locator('.section-title', { hasText: 'OPENAI CONFIGURATION' })).toBeVisible();

    // Fill out the API Key and Base URL
    const apiKeyInput = page.locator('input[type="password"]');
    const baseUrlInput = page.locator('input[placeholder="https://api.openai.com/v1"]');
    
    await apiKeyInput.fill('sk-test-12345');
    await baseUrlInput.fill('https://custom.api.url/v1');

    // Click Save Settings
    await page.locator('button', { hasText: 'Save Settings' }).click();

    // Verify success message
    await expect(page.locator('.status-msg')).toHaveText('Settings saved!');

    // Reload the page to verify persistence (tests the IndexedDB layer)
    await page.reload();

    // Navigate back to Settings
    await page.locator('.tab-item', { hasText: 'Settings' }).click();

    // Assert that the values were preserved after reload
    await expect(apiKeyInput).toHaveValue('sk-test-12345');
    await expect(baseUrlInput).toHaveValue('https://custom.api.url/v1');

    // Query IndexedDB directly to strictly verify that content was saved properly
    const savedConfig = await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('CopilotSidebarDB', 2);
        request.onsuccess = (e) => {
          const db = e.target.result;
          const transaction = db.transaction(['settings'], 'readonly');
          const store = transaction.objectStore('settings');
          const getReq = store.get('openai'); // LLM_PROVIDERS.OPENAI
          
          getReq.onsuccess = () => resolve(getReq.result);
          getReq.onerror = () => reject('Failed to fetch from store');
        };
        request.onerror = () => reject('Failed to open IndexedDB');
      });
    });

    expect(savedConfig).toBeDefined();
    expect(savedConfig.apiKey).toBe('sk-test-12345');
    expect(savedConfig.baseUrl).toBe('https://custom.api.url/v1');
  });
});
