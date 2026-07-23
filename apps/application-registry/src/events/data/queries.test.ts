import { describe, expect, test } from 'bun:test'

import { eventsAtom } from './queries'

describe('event query atoms', () => {
  test('reuses an atom for structurally equal request values', () => {
    const first = eventsAtom({
      enabled: true,
      size: 50,
    })
    const second = eventsAtom({
      enabled: true,
      size: 50,
    })

    expect(second).toBe(first)
    expect(eventsAtom({ enabled: true, size: 25 })).not.toBe(first)
  })
})
