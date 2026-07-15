import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'

import { schemaCursorState } from './cursor-state'

describe('schema cursor state', () => {
  test('encodes and validates state through one Effect Schema', () => {
    const codec = schemaCursorState(
      Schema.Struct({ asOf: Schema.String, revision: Schema.Int })
    )
    const state = { asOf: '2026-07-15T00:00:00.000Z', revision: 4 }

    expect(codec.decode(codec.encode(state))).toEqual(state)
    expect(() => codec.decode({ ...state, revision: 1.5 })).toThrow()
  })
})
