import { describe, expect, test } from 'bun:test'
import * as Effect from 'effect/Effect'
import {
  extractGraphqlErrorMessages,
  normalizeCloudflareAnalyticsResponse,
} from './normalize'
import { createCloudflareAnalyticsRange } from './range'
import { cloudflarePayload } from './test-fixtures'

describe('cloudflare analytics normalization', () => {
  test('normalizes daily rows without double counting top path rows', async () => {
    const data = await Effect.runPromise(
      normalizeCloudflareAnalyticsResponse(
        cloudflarePayload,
        createCloudflareAnalyticsRange({
          from: '2026-06-17',
          to: '2026-06-18',
        })
      )
    )

    expect(data.summary.audienceViews).toBe(3)
    expect(data.summary.publicViews).toBe(5)
    expect(JSON.stringify(data)).not.toMatch(/[?&]p=/u)
  })

  test('extracts GraphQL error messages without returning raw payloads', () => {
    expect(
      extractGraphqlErrorMessages({
        errors: [{ message: 'bad zone' }, { detail: 'ignored' }],
      })
    ).toEqual(['bad zone'])
  })
})
