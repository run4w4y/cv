import { describe, expect, test } from 'bun:test'

import { concatBytes } from './bytes'

describe('byte helpers', () => {
  test('concatBytes preserves byte order', () => {
    expect(
      concatBytes(Uint8Array.from([1, 2]), Uint8Array.from([3, 4, 5]))
    ).toEqual(Uint8Array.from([1, 2, 3, 4, 5]))
  })
})
