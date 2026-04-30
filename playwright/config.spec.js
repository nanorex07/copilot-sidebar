import { test, expect } from '@playwright/test';

test.describe('Config Page & Storage', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('should save and persist Agent Loop Limits', async ({ page }) => {
    // Navigate to Config tab
    await page.locator('.tab-item', { hasText: 'Config' }).click();
    
    // Ensure we are on the Config page
    await expect(page.locator('.section-title', { hasText: 'AGENT LOOP LIMITS' })).toBeVisible();

    // Find the input for AGENT MAX STEPS. Since the label is generated from keys, we look for 'AGENT MAX STEPS'
    const maxStepsContainer = page.locator('.input-group', { hasText: 'AGENT MAX STEPS' });
    const maxStepsInput = maxStepsContainer.locator('input[type="number"]');
    
    // Change value
    await maxStepsInput.fill('150');

    // Click Save in the Agent Loop Limits section
    // There are multiple save buttons, so we target the one inside the Agent Loop Limits section
    const limitsSection = page.locator('.settings-section', { hasText: 'AGENT LOOP LIMITS' });
    await limitsSection.locator('button', { hasText: 'Save' }).click();

    // Verify success message
    await expect(limitsSection.locator('.status-msg')).toHaveText('Saved successfully!');

    // Reload the page to verify persistence (tests the IndexedDB layer)
    await page.reload();

    // Navigate back to Config
    await page.locator('.tab-item', { hasText: 'Config' }).click();

    // Assert that the value was preserved after reload
    const maxStepsContainerReloaded = page.locator('.input-group', { hasText: 'AGENT MAX STEPS' });
    await expect(maxStepsContainerReloaded.locator('input[type="number"]')).toHaveValue('150');

    // Query IndexedDB directly to strictly verify that content was saved properly
    const savedLimits = await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('CopilotSidebarDB', 2);
        request.onsuccess = (e) => {
          const db = e.target.result;
          const transaction = db.transaction(['settings'], 'readonly');
          const store = transaction.objectStore('settings');
          const getReq = store.get('agent_limits'); // CONFIG_KEYS.AGENT_LIMITS
          getReq.onsuccess = () => resolve(getReq.result);
          getReq.onerror = () => reject('Failed to fetch from store');
        };
        request.onerror = () => reject('Failed to open IndexedDB');
      });
    });

    expect(savedLimits).toBeDefined();
    expect(savedLimits.AGENT_MAX_STEPS).toBe(150);
  });

  test('should save and persist User Settings', async ({ page }) => {
    // Navigate to Config tab
    await page.locator('.tab-item', { hasText: 'Config' }).click();

    const userSettingsSection = page.locator('.settings-section', { hasText: 'USER SETTINGS' });
    const instructionsInput = userSettingsSection.locator('textarea');
    
    await instructionsInput.fill('Test custom instruction');

    await userSettingsSection.locator('button', { hasText: 'Save' }).click();
    await expect(userSettingsSection.locator('.status-msg')).toHaveText('Saved successfully!');

    await page.reload();
    await page.locator('.tab-item', { hasText: 'Config' }).click();

    const userSettingsSectionReloaded = page.locator('.settings-section', { hasText: 'USER SETTINGS' });
    await expect(userSettingsSectionReloaded.locator('textarea')).toHaveValue('Test custom instruction');

    // Query IndexedDB directly to strictly verify that content was saved properly
    const savedUserSettings = await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('CopilotSidebarDB', 2);
        request.onsuccess = (e) => {
          const db = e.target.result;
          const transaction = db.transaction(['settings'], 'readonly');
          const store = transaction.objectStore('settings');
          const getReq = store.get('user_settings'); // CONFIG_KEYS.USER_SETTINGS
          getReq.onsuccess = () => resolve(getReq.result);
          getReq.onerror = () => reject('Failed to fetch from store');
        };
        request.onerror = () => reject('Failed to open IndexedDB');
      });
    });

    expect(savedUserSettings).toBeDefined();
    expect(savedUserSettings.customInstructions).toBe('Test custom instruction');
  });
});
