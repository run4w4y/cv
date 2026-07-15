import { describe, expect, test } from 'bun:test'

import { QueryError } from '../error'
import { resolveOptions, resolveSize } from './options'

describe('pagination options', () => {
  test('resolves defaults and enforces definition constraints', () => {
    expect(resolveOptions({})).toEqual({
      defaultSize: 25,
      maxSize: 100,
      overflow: 'reject',
    })

    for (const options of [
      { defaultSize: 0 },
      { maxSize: 0 },
      { defaultSize: 3, maxSize: 2 },
    ]) {
      expect(() => resolveOptions(options)).toThrow(QueryError)
    }
  })

  test('rejects or clamps oversized requests according to the definition', () => {
    const reject = resolveOptions({ defaultSize: 2, maxSize: 3 })
    const clamp = resolveOptions({
      defaultSize: 2,
      maxSize: 3,
      overflow: 'clamp',
    })

    expect(resolveSize(undefined, reject)).toBe(2)
    expect(() => resolveSize(0, reject)).toThrow(QueryError)
    expect(() => resolveSize(4, reject)).toThrow(QueryError)
    expect(resolveSize(4, clamp)).toBe(3)
  })
})
