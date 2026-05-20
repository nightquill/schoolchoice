import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:8000';

function resize(path: string) {
  try {
    const info = execSync(`sips -g pixelWidth -g pixelHeight "${path}" 2>/dev/null`, { encoding: 'utf-8' });
    const w = parseInt(info.match(/pixelWidth:\s*(\d+)/)?.[1] || '0', 10);
    const h = parseInt(info.match(/pixelHeight:\s*(\d+)/)?.[1] || '0', 10);
    if (w > 1800 || h > 1800) {
      const scale = Math.min(1800 / w, 1800 / h);
      execSync(`sips --resampleHeightWidth ${Math.round(h * scale)} ${Math.round(w * scale)} "${path}" 2>/dev/null`);
    }
  } catch {}
}

async function shot(page, path: string) {
  await page.screenshot({ path });
  resize(path);
}

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', 'verify@test.com');
  await page.fill('input[name="password"]', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  await page.waitForLoadState('networkidle');
}

async function getToken(): Promise<string> {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'verify@test.com', password: 'verify123' }),
  });
  const data = await res.json();
  return data.access_token;
}

test.describe('Bilingual student names', () => {

  test('Student profile shows Chinese Name field in personal tab', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/students`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Click first student row
    const firstRow = page.locator('tr[role="row"]').first();
    await firstRow.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Navigate to personal tab
    const personalTab = page.locator('button', { hasText: /Personal|個人/ });
    if (await personalTab.count() > 0) {
      await personalTab.click();
      await page.waitForTimeout(500);
    }

    // Should have Chinese Name field
    const chineseNameLabel = page.locator('label', { hasText: /Chinese Name|中文姓名/ });
    await expect(chineseNameLabel).toBeVisible();

    await shot(page, 'e2e/screenshots/bilingual-personal-tab.png');
  });

  test('Student list API includes name_zh field', async ({ page }) => {
    const token = await getToken();

    const response = await fetch(`${API}/api/v1/students`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toBeDefined();
    expect(data.items.length).toBeGreaterThan(0);
    // name_zh field should exist (even if null for all students)
    const firstItem = data.items[0];
    expect('name_zh' in firstItem).toBe(true);
  });

  test('CSV export includes Name (Chinese) column', async ({ page }) => {
    const token = await getToken();

    const response = await fetch(`${API}/api/v1/students/export`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    const csv = await response.text();
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toContain('Name (Chinese)');
  });

  test('Student list renders correctly', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/students`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Verify student names render (not broken by localization)
    const rows = page.locator('tr[role="row"]');
    expect(await rows.count()).toBeGreaterThan(0);

    await shot(page, 'e2e/screenshots/bilingual-student-list.png');
  });

});
