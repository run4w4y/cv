import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'

import {
  decodeBase64,
  decodeOpaquePayload,
  encodeBase64,
} from './opaque-payload'

describe('opaque HTTP payloads', () => {
  test('round-trips exact bytes without interpreting their shape', async () => {
    const original = new TextEncoder().encode('{"arbitrary":[1,true,null]}')
    const data = encodeBase64(original)
    const decoded = await Effect.runPromise(
      decodeOpaquePayload({ data, mediaType: 'application/json' })
    )

    expect(decoded.mediaType).toBe('application/json')
    expect(decoded.bytes).toEqual(original)
  })

  test('maps malformed base64 to a typed bad-request error', async () => {
    const exit = await Effect.runPromiseExit(decodeBase64('%%%'))
    expect(exit._tag).toBe('Failure')
  })
})
