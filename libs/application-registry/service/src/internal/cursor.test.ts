import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'

import { decodeCursor, encodeCursor } from './cursor'

describe('registry cursors', () => {
  test('round trips a revision', async () => {
    const encoded = encodeCursor({ revision: 42 })
    expect(await Effect.runPromise(decodeCursor(encoded))).toEqual({
      revision: 42,
    })
  })

  test('rejects malformed and negative revisions', async () => {
    const malformed = await Effect.runPromise(
      decodeCursor('revision=wat').pipe(Effect.flip)
    )
    const negative = await Effect.runPromise(
      decodeCursor('revision=-1').pipe(Effect.flip)
    )

    expect(malformed._tag).toBe('RegistryBadRequestError')
    expect(negative._tag).toBe('RegistryBadRequestError')
  })
})
