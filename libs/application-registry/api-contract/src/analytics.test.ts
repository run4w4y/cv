import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'

import { CvAnalyticsQuerySchema } from './analytics'

const decodeQuery = Schema.decodeUnknownSync(CvAnalyticsQuerySchema)

describe('CvAnalyticsQuerySchema', () => {
  test('decodes preset and custom ranges', () => {
    expect(decodeQuery({ days: '7' })).toEqual({ days: 7 })
    expect(decodeQuery({ from: '2026-07-15', to: '2026-07-21' })).toEqual({
      from: '2026-07-15',
      to: '2026-07-21',
    })
  })

  test('leaves range relationships and provider availability to the service', () => {
    expect(decodeQuery({ from: '2026-07-15' })).toEqual({
      from: '2026-07-15',
    })
    expect(
      decodeQuery({
        days: '7',
        from: '2026-07-15',
        to: '2026-07-21',
      })
    ).toEqual({
      days: 7,
      from: '2026-07-15',
      to: '2026-07-21',
    })
    expect(decodeQuery({ from: '2026-06-01', to: '2026-07-21' })).toEqual({
      from: '2026-06-01',
      to: '2026-07-21',
    })
  })

  test('rejects malformed calendar dates', () => {
    expect(() =>
      decodeQuery({ from: '2026-02-30', to: '2026-03-01' })
    ).toThrow()
  })
})
