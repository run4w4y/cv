import { describe, expect, test } from 'bun:test'

import { applicationsAtom } from './queries'

describe('applications query atoms', () => {
  test('reuses an atom for structurally equal request values', () => {
    const first = applicationsAtom({
      enabled: true,
      q: 'effect',
      size: 50,
    })
    const second = applicationsAtom({
      enabled: true,
      q: 'effect',
      size: 50,
    })

    expect(second).toBe(first)
    expect(
      applicationsAtom({
        enabled: true,
        q: 'effect',
        size: 25,
      })
    ).not.toBe(first)
  })
})
