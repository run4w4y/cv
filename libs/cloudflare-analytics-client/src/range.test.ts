import { describe, expect, test } from 'bun:test'
import * as Effect from 'effect/Effect'

import {
  chunkCloudflareAnalyticsRange,
  resolveCloudflareAnalyticsRange,
} from './range'

describe('cloudflare analytics range chunking', () => {
  test('splits wider ranges into one-day chunks', async () => {
    const chunks = await Effect.runPromise(
      chunkCloudflareAnalyticsRange(
        {
          from: '2026-06-01T00:00:00.000Z',
          to: '2026-06-03T00:00:00.000Z',
        },
        {
          now: new Date('2026-06-03T00:00:00.000Z'),
        }
      )
    )

    expect(chunks).toEqual([
      {
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-02T00:00:00.000Z',
      },
      {
        from: '2026-06-02T00:00:00.000Z',
        to: '2026-06-03T00:00:00.000Z',
      },
    ])
  })

  test('clamps broad dashboard ranges to the free-plan lookback window', async () => {
    const resolved = await Effect.runPromise(
      resolveCloudflareAnalyticsRange(
        {
          from: '2026-05-24T00:00:00.000Z',
          to: '2026-06-23T00:00:00.000Z',
        },
        {
          now: new Date('2026-06-23T00:00:00.000Z'),
        }
      )
    )

    expect(resolved.effectiveRange).toEqual({
      from: '2026-06-16T00:00:00.000Z',
      to: '2026-06-23T00:00:00.000Z',
    })
    expect(resolved.chunks).toHaveLength(7)
    expect(resolved.chunks[0]).toEqual({
      from: '2026-06-16T00:00:00.000Z',
      to: '2026-06-17T00:00:00.000Z',
    })
    expect(resolved.chunks.at(-1)).toEqual({
      from: '2026-06-22T00:00:00.000Z',
      to: '2026-06-23T00:00:00.000Z',
    })
  })

  test('accepts Grafana Infinity time macros as epoch milliseconds', async () => {
    const resolved = await Effect.runPromise(
      resolveCloudflareAnalyticsRange(
        {
          from: String(Date.parse('2026-06-21T00:00:00.000Z')),
          to: String(Date.parse('2026-06-22T00:00:00.000Z')),
        },
        {
          now: new Date('2026-06-23T00:00:00.000Z'),
        }
      )
    )

    expect(resolved).toEqual({
      chunks: [
        {
          from: '2026-06-21T00:00:00.000Z',
          to: '2026-06-22T00:00:00.000Z',
        },
      ],
      effectiveRange: {
        from: '2026-06-21T00:00:00.000Z',
        to: '2026-06-22T00:00:00.000Z',
      },
    })
  })

  test('returns no chunks when the whole range is outside available analytics', async () => {
    const resolved = await Effect.runPromise(
      resolveCloudflareAnalyticsRange(
        {
          from: '2026-05-01T00:00:00.000Z',
          to: '2026-05-02T00:00:00.000Z',
        },
        {
          now: new Date('2026-06-23T00:00:00.000Z'),
        }
      )
    )

    expect(resolved).toEqual({
      chunks: [],
      effectiveRange: {
        from: '2026-05-01T00:00:00.000Z',
        to: '2026-05-02T00:00:00.000Z',
      },
    })
  })
})
