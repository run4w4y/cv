import {
  type RegistryEvent,
  RegistryEventPublishError,
  RegistryEventSchema,
  RegistryEventSourceError,
} from '@cv/application-registry-events'
import { Effect, Schema } from 'effect'

const textDecoder = new TextDecoder()
const textEncoder = new TextEncoder()

export const encodeRegistryEvent = (
  event: RegistryEvent
): Effect.Effect<Uint8Array, RegistryEventPublishError> =>
  Schema.encodeEffect(RegistryEventSchema)(event).pipe(
    Effect.flatMap((encoded) =>
      Effect.try({
        try: () => textEncoder.encode(JSON.stringify(encoded)),
        catch: (cause) =>
          new RegistryEventPublishError({
            cause,
            eventId: event.eventId,
            message: 'Could not encode the registry event.',
          }),
      })
    ),
    Effect.mapError((cause) =>
      Schema.is(RegistryEventPublishError)(cause)
        ? cause
        : new RegistryEventPublishError({
            cause,
            eventId: event.eventId,
            message: 'Could not encode the registry event.',
          })
    )
  )

export const decodeRegistryEvent = (
  bytes: Uint8Array
): Effect.Effect<RegistryEvent, RegistryEventSourceError> =>
  Effect.try({
    try: () => JSON.parse(textDecoder.decode(bytes)) as unknown,
    catch: (cause) =>
      new RegistryEventSourceError({
        cause,
        message: 'Could not decode the registry event JSON.',
        operation: 'decode',
      }),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(RegistryEventSchema)),
    Effect.mapError((cause) =>
      Schema.is(RegistryEventSourceError)(cause)
        ? cause
        : new RegistryEventSourceError({
            cause,
            message: 'Registry event schema validation failed.',
            operation: 'decode',
          })
    )
  )
