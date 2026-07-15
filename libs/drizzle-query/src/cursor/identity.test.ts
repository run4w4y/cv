import { describe, expect, test } from 'bun:test'
import { cursorDefinitionIdentity, cursorQueryIdentity } from './identity'

const fixture = {
  name: 'stable',
  config: { b: 2, a: 1 },
  list: ['x', 1, true],
  at: new Date('2024-01-02T03:04:05.000Z'),
  count: 9_007_199_254_740_993n,
}

describe('cursor identities', () => {
  test('use versioned prefixes and a stable golden digest', () => {
    const digest = 'q9V3LmXfdk-VSnGeBQwEwh9bw25xP1TIWxC-z3EzKu4'

    expect(cursorDefinitionIdentity(fixture)).toBe(`d2:${digest}`)
    expect(cursorQueryIdentity(fixture)).toBe(`q2:${digest}`)
  })

  test('is stable across plain-object key order', () => {
    expect(
      cursorQueryIdentity({
        name: 'stable',
        config: { a: 1, b: 2 },
        list: ['x', 1, true],
        at: new Date('2024-01-02T03:04:05.000Z'),
        count: 9_007_199_254_740_993n,
      })
    ).toBe(cursorQueryIdentity(fixture))
  })

  test('keeps array order significant', () => {
    expect(cursorQueryIdentity([1, 2])).not.toBe(cursorQueryIdentity([2, 1]))
  })

  test('preserves Date, bigint, number, and string distinctions', () => {
    const timestamp = '2024-01-02T03:04:05.000Z'
    expect(cursorQueryIdentity(new Date(timestamp))).toBe(
      cursorQueryIdentity(new Date(timestamp))
    )
    expect(cursorQueryIdentity(new Date(timestamp))).not.toBe(
      cursorQueryIdentity(timestamp)
    )

    const numericIdentities = [
      cursorQueryIdentity(1n),
      cursorQueryIdentity(1),
      cursorQueryIdentity('1'),
    ]
    expect(new Set(numericIdentities).size).toBe(numericIdentities.length)
  })
})
