import { test, expect } from '@playwright/test';

// This is a minimal/example Playwright test. Adjust `baseURL` in Playwright config
// or run against a locally served app (e.g., `npm run dev`) and use the `--headed` flag.

test('basic sanity', async ({ page }) => {
  await page.goto('http://localhost:8080/');
  expect(page.url()).toBeTruthy();
});
