import { defineConfig, devices } from '@playwright/test'

const url = 'http://127.0.0.1:4183'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: url, locale: 'ru-RU', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm --filter @coverage/web exec vite preview --host 127.0.0.1 --port 4183 --strictPort',
    url, reuseExistingServer: !process.env.CI, timeout: 30_000,
  },
})
