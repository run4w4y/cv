import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'

import { decodePdfQueueMessage, encodePdfQueueMessage } from './codec'

const request = {
  _tag: 'PdfGenerationRequested' as const,
  applicationId: 'application-1',
  artifactId: 'artifact-1',
  entryId: 'entry-1',
  version: 1 as const,
}

describe('PDF queue codec', () => {
  test('round trips the versioned request', async () => {
    const decoded = await Effect.runPromise(
      encodePdfQueueMessage(request).pipe(Effect.flatMap(decodePdfQueueMessage))
    )

    expect(decoded).toEqual(request)
  })

  test('rejects malformed payloads', async () => {
    const result = await Effect.runPromise(
      decodePdfQueueMessage(new TextEncoder().encode('{"version":2}')).pipe(
        Effect.flip
      )
    )

    expect(result._tag).toBe('PdfQueueError')
    expect(result.operation).toBe('decode')
  })
})
