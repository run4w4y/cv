import { describe, expect, test } from 'bun:test'
import {
  RegistryEventSchema,
  RegistryEventSourceError,
} from '@cv/application-registry-events'
import { Effect } from 'effect'

import { decodeRegistryEvent, encodeRegistryEvent } from './codec'

const event = RegistryEventSchema.cases.ApplicationUpdated.make({
  applicationId: 'application-1',
  applicationVersion: 2,
  changedFields: ['applicationStatus'],
  correlationId: 'update-1',
  eventId: 'application-updated:update-1',
  occurredAt: '2026-07-21T12:00:00.000Z',
  status: 'applied',
  version: 1,
})

describe('registry event codec', () => {
  test('round-trips a versioned domain event', async () => {
    const decoded = await Effect.runPromise(
      encodeRegistryEvent(event).pipe(Effect.flatMap(decodeRegistryEvent))
    )

    expect(decoded).toEqual(event)
  })

  test('rejects messages outside the registry event contract', async () => {
    const error = await Effect.runPromise(
      decodeRegistryEvent(new TextEncoder().encode('{"version":2}')).pipe(
        Effect.flip
      )
    )

    expect(error).toBeInstanceOf(RegistryEventSourceError)
    expect(error.operation).toBe('decode')
  })
})
