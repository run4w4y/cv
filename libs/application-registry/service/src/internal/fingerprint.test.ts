import { describe, expect, test } from 'bun:test'

import { requestFingerprint } from './fingerprint'

describe('requestFingerprint', () => {
  test('is stable across object key order and ignores undefined fields', () => {
    const left = requestFingerprint('test', {
      b: 2,
      nested: { z: true, a: 'value' },
      omitted: undefined,
    })
    const right = requestFingerprint('test', {
      nested: { a: 'value', z: true },
      b: 2,
    })

    expect(left).toBe(right)
  })
})
