import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

test.describe('Organisation NavBar verification', () => {
  test('login and verify org name appears in navbar', async ({ page }) => {
    // 1. Navigate to login
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'tests/screenshots/01-login-page.png', fullPage: true });

    // 2. Fill in credentials and submit
    await page.fill('input[type="email"], input[name="email"]', 'verify@test.com');
    await page.fill('input[type="password"], input[name="password"]', 'verify123');
    await page.click('button:has-text("Log In")');

    // 3. Wait for redirect to dashboard
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'tests/screenshots/03-dashboard.png', fullPage: true });

    // 4. Verify org name is in the nav DOM
    const nav = page.locator('nav').first();
    const navText = await nav.textContent();
    console.log('Nav text content:', navText);

    expect(navText).toContain('St Pauls College');
    console.log('PASS: Nav contains "St Pauls College"');

    // 5. Find the specific org name span and verify it's attached
    const orgSpan = page.locator('nav span:has-text("St Pauls College")');
    const count = await orgSpan.count();
    console.log('Org name span count in nav:', count);
    expect(count).toBeGreaterThan(0);

    // 6. Take close-up screenshot of nav area
    const navBox = await nav.boundingBox();
    if (navBox) {
      await page.screenshot({
        path: 'tests/screenshots/04-navbar-closeup.png',
        clip: { x: navBox.x, y: navBox.y, width: navBox.width, height: navBox.height + 10 },
      });
    }

    // 7. Verify user email is also shown
    expect(navText).toContain('verify@test.com');
    console.log('PASS: Nav contains user email "verify@test.com"');

    console.log('ALL CHECKS PASSED');
  });
});
