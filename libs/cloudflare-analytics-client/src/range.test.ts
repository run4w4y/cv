import { describe, expect, test } from 'bun:test'
import * as Effect from 'effect/Effect'

import { chunkRange, resolveRange } from './range'
import type { DatasetLimits } from './types'

const dayMs = 24 * 60 * 60 * 1_000

const limits = (overrides: Partial<DatasetLimits> = {}): DatasetLimits => ({
  maxDurationMs: dayMs,
  maxPageSize: 5_000,
  retentionMs: 31 * dayMs,
  ...overrides,
})

describe('cloudflare analytics range chunking', () => {
  test('splits ranges using the provider maximum duration', async () => {
    const chunks = await Effect.runPromise(
      chunkRange(
        {
          from: '2026-06-01T00:00:00.000Z',
          to: '2026-06-03T00:00:00.000Z',
        },
        limits(),
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

  test('accepts the full provider retention window without clipping it', async () => {
    const resolved = await Effect.runPromise(
      resolveRange(
        {
          from: '2026-05-24T00:00:00.000Z',
          to: '2026-06-23T00:00:00.000Z',
        },
        limits({ maxDurationMs: 7 * dayMs }),
        {
          now: new Date('2026-06-23T00:00:00.000Z'),
        }
      )
    )

    expect(resolved.effectiveRange).toEqual({
      from: '2026-05-24T00:00:00.000Z',
      to: '2026-06-23T00:00:00.000Z',
    })
    expect(resolved.chunks).toHaveLength(5)
    expect(resolved.chunks[0]).toEqual({
      from: '2026-05-24T00:00:00.000Z',
      to: '2026-05-31T00:00:00.000Z',
    })
    expect(resolved.chunks.at(-1)).toEqual({
      from: '2026-06-21T00:00:00.000Z',
      to: '2026-06-23T00:00:00.000Z',
    })
  })

  test('accepts Grafana Infinity time macros as epoch milliseconds', async () => {
    const resolved = await Effect.runPromise(
      resolveRange(
        {
          from: String(Date.parse('2026-06-21T00:00:00.000Z')),
          to: String(Date.parse('2026-06-22T00:00:00.000Z')),
        },
        limits(),
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

  test('rejects ranges older than provider retention instead of clipping', async () => {
    const exit = await Effect.runPromiseExit(
      resolveRange(
        {
          from: '2026-05-01T00:00:00.000Z',
          to: '2026-05-02T00:00:00.000Z',
        },
        limits(),
        {
          now: new Date('2026-06-23T00:00:00.000Z'),
        }
      )
    )

    expect(exit._tag).toBe('Failure')
    expect(exit.toString()).toContain('RangeValidationError')
  })
})
