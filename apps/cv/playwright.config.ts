import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import { e2eFixtureEnv } from './e2e/fixture-env'

const port = Number(process.env.CV_E2E_PORT ?? process.env.PORT ?? 4381)
const host = '127.0.0.1'
const executablePath = process.env.CV_CHROME_PATH ?? process.env.CHROME_PATH
const rootDir = fileURLToPath(new URL('../..', import.meta.url))
const outputDir =
  process.env.PLAYWRIGHT_OUTPUT_DIR ?? `${rootDir}/.cv-work/playwright-results`

export default defineConfig({
  expect: {
    timeout: 5_000,
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  outputDir,
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
      use: {
        ...devices['Pixel 5'],
      },
    },
  ],
  reporter: process.env.CI ? 'github' : 'list',
  retries: process.env.CI ? 1 : 0,
  testDir: `${rootDir}/apps/cv/e2e`,
  timeout: 30_000,
  workers: Number(process.env.CV_E2E_WORKERS ?? 4),
  use: {
    baseURL: `http://${host}:${port}`,
    launchOptions: executablePath ? { executablePath } : undefined,
    trace: process.env.CV_E2E_TRACE === '1' ? 'retain-on-failure' : 'off',
  },
  webServer: {
    command: `./node_modules/.bin/nx run cv:build --skip-nx-cache && ./node_modules/.bin/nx run cv:preview -- --host ${host} --port ${port}`,
    cwd: rootDir,
    env: {
      ...e2eFixtureEnv,
      NX_PARALLEL: '1',
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: `http://${host}:${port}/en/`,
  },
})
