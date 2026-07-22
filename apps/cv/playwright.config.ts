import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.CV_E2E_PORT ?? 4381)
const host = 'localhost'
const executablePath = process.env.CV_CHROME_PATH ?? process.env.CHROME_PATH
const rootDir = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig({
  expect: {
    timeout: 5_000,
    toHaveScreenshot: { maxDiffPixels: 500 },
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  outputDir: `${rootDir}/.cv-work/cv-playwright-results`,
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { height: 900, width: 1440 },
      },
    },
    {
      name: 'chromium-mobile',
      use: devices['Pixel 5'],
    },
  ],
  reporter: process.env.CI ? 'github' : 'list',
  retries: process.env.CI ? 1 : 0,
  testDir: `${rootDir}/apps/cv/e2e`,
  timeout: 30_000,
  use: {
    baseURL: `http://${host}:${port}`,
    launchOptions: executablePath ? { executablePath } : undefined,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: './node_modules/.bin/nx run cv:dev:fixture',
    cwd: rootDir,
    env: {
      ...process.env,
      CV_FIXTURE_PORT: port.toString(10),
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: `http://${host}:${port}/c/fixture`,
  },
})
