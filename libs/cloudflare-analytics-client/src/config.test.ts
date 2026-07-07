import { describe, expect, test } from 'bun:test'
import * as Effect from 'effect/Effect'
import {
  hasCloudflareAnalyticsEnv,
  readCloudflareAnalyticsConfigFromEnv,
} from './config'
import { CloudflareAnalyticsConfigError } from './errors'

describe('cloudflare analytics config', () => {
  test('parses required config from env without exposing token values', async () => {
    const parsed = await Effect.runPromise(
      readCloudflareAnalyticsConfigFromEnv({
        CLOUDFLARE_API_TOKEN: 'token-value',
        CLOUDFLARE_ZONE_ID: 'zone-value',
        CV_WEB_HOST: 'cv.example.test',
      })
    )

    expect(parsed.zoneId).toBe('zone-value')
    expect(parsed.host).toBe('cv.example.test')
    expect(String(parsed.apiToken)).not.toContain('token-value')
  })

  test('fails with a typed config error when env is absent', async () => {
    const result = await Effect.runPromiseExit(
      readCloudflareAnalyticsConfigFromEnv({})
    )

    expect(result._tag).toBe('Failure')
    expect(result.toString()).toContain('CloudflareAnalyticsConfigError')
    expect(hasCloudflareAnalyticsEnv({})).toBe(false)
  })

  test('uses a typed config error for missing env', () => {
    const error = CloudflareAnalyticsConfigError.missingEnv([
      'CLOUDFLARE_API_TOKEN',
    ])

    expect(error).toBeInstanceOf(CloudflareAnalyticsConfigError)
  })
})
