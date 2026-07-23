import { describe, expect, test } from 'bun:test'

import { splitRange } from './range'

const dayMs = 24 * 60 * 60 * 1_000

describe('cloudflare analytics range chunking', () => {
  test('splits canonical ranges using the provider maximum duration', () => {
    const chunks = splitRange(
      {
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-03T00:00:00.000Z',
      },
      dayMs
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

  test('preserves a final partial chunk', () => {
    const chunks = splitRange(
      {
        from: '2026-05-24T00:00:00.000Z',
        to: '2026-06-23T00:00:00.000Z',
      },
      7 * dayMs
    )

    expect(chunks).toHaveLength(5)
    expect(chunks[0]).toEqual({
      from: '2026-05-24T00:00:00.000Z',
      to: '2026-05-31T00:00:00.000Z',
    })
    expect(chunks.at(-1)).toEqual({
      from: '2026-06-21T00:00:00.000Z',
      to: '2026-06-23T00:00:00.000Z',
    })
  })
})
