import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', workers: 1, timeout: 60_000,
  use: { baseURL: 'http://localhost:9002', viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: process.env.CI ? 'npm run start -- -p 9002' : 'npm run dev', url: 'http://localhost:9002', reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
