import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { sanitizeAnalyticsInput } from './sanitize'
import type { AnalyticsDashboardData } from './types'

const rootDir = fileURLToPath(new URL('../../..', import.meta.url))
const fixturePath = (name: string) =>
  resolve(rootDir, 'fixtures', 'analytics', name)
const readFixture = async (name: string): Promise<unknown> =>
  JSON.parse(await readFile(fixturePath(name), 'utf8'))
const stableJson = (value: unknown) => JSON.stringify(value, null, 2)

describe('sanitizeAnalyticsInput', () => {
  test('sanitizes dangerous raw Cloudflare aggregates to the public fixture', async () => {
    const raw = await readFixture('raw-dangerous-sample.json')
    const expected = (await readFixture(
      'expected-public-sample.json'
    )) as AnalyticsDashboardData
    const sanitized = sanitizeAnalyticsInput(raw)
    const stableSanitized = {
      ...sanitized,
      generatedAt: '1970-01-01T00:00:00.000Z',
    }

    expect(stableJson(stableSanitized)).toBe(stableJson(expected))
    expect(JSON.stringify(stableSanitized)).not.toMatch(
      /[?&]p=|person@example|192\.0\.2\.44|DangerBrowser/u
    )
  })
})
