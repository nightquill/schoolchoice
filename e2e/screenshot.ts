/**
 * e2e/screenshot.ts
 *
 * Drop-in replacement for page.screenshot() that auto-resizes images
 * exceeding 2000px in either dimension. Uses macOS `sips` (no deps).
 *
 * Usage:
 *   import { screenshot } from './screenshot';
 *   await screenshot(page, 'e2e/screenshots/my-shot.png');
 *   await screenshot(page, 'e2e/screenshots/full.png', { fullPage: true });
 */
import { execSync } from 'child_process';
import type { Page, Locator } from '@playwright/test';

const MAX_DIM = 1800; // stay well under 2000px API limit

export async function screenshot(
  target: Page | Locator,
  path: string,
  opts: { fullPage?: boolean; clip?: { x: number; y: number; width: number; height: number } } = {},
): Promise<void> {
  await target.screenshot({ path, ...opts });
  resize(path);
}

function resize(path: string): void {
  try {
    // Get dimensions via sips (macOS built-in)
    const info = execSync(`sips -g pixelWidth -g pixelHeight "${path}" 2>/dev/null`, {
      encoding: 'utf-8',
    });
    const w = parseInt(info.match(/pixelWidth:\s*(\d+)/)?.[1] || '0', 10);
    const h = parseInt(info.match(/pixelHeight:\s*(\d+)/)?.[1] || '0', 10);

    if (w <= MAX_DIM && h <= MAX_DIM) return; // already fine

    // Scale down to fit within MAX_DIM, preserving aspect ratio
    const scale = Math.min(MAX_DIM / w, MAX_DIM / h);
    const newW = Math.round(w * scale);
    const newH = Math.round(h * scale);

    execSync(
      `sips --resampleHeightWidth ${newH} ${newW} "${path}" 2>/dev/null`,
    );
  } catch {
    // If sips fails (non-macOS), silently continue — screenshot still exists
  }
}
