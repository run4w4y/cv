import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.INTERNAL_UI_E2E_PORT ?? 4405)
const host = '127.0.0.1'
const executablePath = process.env.CV_CHROME_PATH ?? process.env.CHROME_PATH
const rootDir = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig({
  expect: { timeout: 5_000 },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  outputDir: `${rootDir}/.cv-work/internal-ui-playwright-results`,
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { height: 900, width: 1440 },
      },
    },
  ],
  reporter: process.env.CI ? 'github' : 'list',
  retries: process.env.CI ? 1 : 0,
  testDir: `${rootDir}/libs/internal-ui/e2e`,
  timeout: 30_000,
  use: {
    baseURL: `http://${host}:${port}`,
    launchOptions: executablePath ? { executablePath } : undefined,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `./node_modules/.bin/storybook dev --config-dir libs/internal-ui/.storybook --port ${port} --ci`,
    cwd: rootDir,
    reuseExistingServer: false,
    timeout: 120_000,
    url: `http://${host}:${port}/iframe.html`,
  },
})
