import { describe, expect, test } from 'bun:test'

import { parseSorting, serializeSorting } from './sorting'

const fallback = [{ id: 'revision', desc: true }]
const sortableFields = new Set(['company', 'role', 'revision'])

describe('registry table sorting codec', () => {
  test('round-trips an ordered multi-column sort', () => {
    const sorting = [
      { id: 'company', desc: false },
      { id: 'role', desc: true },
      { id: 'revision', desc: true },
    ]

    const encoded = serializeSorting(sorting, fallback)

    expect(encoded).toBe('company:asc,role:desc,revision:desc')
    expect(parseSorting(encoded, sortableFields, fallback)).toEqual(sorting)
  })

  test('ignores malformed, unsupported, and duplicate terms', () => {
    expect(
      parseSorting(
        'unknown:asc,company:sideways,role:desc,role:asc',
        sortableFields,
        fallback
      )
    ).toEqual([{ id: 'role', desc: true }])
    expect(parseSorting('invalid', sortableFields, fallback)).toEqual(fallback)
  })
})
