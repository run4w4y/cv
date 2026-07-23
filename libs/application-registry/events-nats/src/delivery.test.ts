import { describe, expect, test } from 'bun:test'
import { RegistryEventSourceError } from '@cv/application-registry-events'
import { Effect } from 'effect'

import { natsMessageAction } from './delivery'

describe('NATS message actions', () => {
  test('maps synchronous transport failures to the source error channel', async () => {
    const error = await Effect.runPromise(
      natsMessageAction('message acknowledgement', () => {
        throw new Error('connection closed')
      }).pipe(Effect.flip)
    )

    expect(error).toBeInstanceOf(RegistryEventSourceError)
    expect(error.operation).toBe('message acknowledgement')
    expect(error.message).toContain('connection closed')
  })
})
