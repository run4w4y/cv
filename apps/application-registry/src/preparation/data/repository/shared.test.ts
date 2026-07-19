import { expect, test } from 'bun:test'
import { Effect } from 'effect'

import { decodeOpaqueValue } from './shared'

test('malformed opaque registry payloads stay in the typed data error channel', async () => {
  const result = await Effect.runPromise(
    Effect.result(
      decodeOpaqueValue(
        'facts',
        new TextEncoder().encode('not json!'),
        'application/json'
      )
    )
  )

  expect(result._tag).toBe('Failure')
  if (result._tag === 'Failure') {
    expect(result.failure._tag).toBe('PreparationDataError')
    expect(result.failure.operation).toBe('facts')
  }
})
