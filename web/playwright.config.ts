import { defineConfig, devices } from '@playwright/test';

/**
 * Test E2E dashboard. Membutuhkan backend (API_URL) dan web (E2E_BASE_URL) yang sudah berjalan
 * dengan database berisi seed dev + seed:demo. Lokal: `npm run e2e`; CI: lihat .github/workflows/ci.yml.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Lokal bisa memakai Chrome terpasang: PW_CHANNEL=chrome npm run e2e
    ...(process.env.PW_CHANNEL && { channel: process.env.PW_CHANNEL }),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
});
