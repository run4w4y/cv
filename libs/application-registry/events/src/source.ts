import { Context, type Effect, Schema, type Stream } from 'effect'

import type { RegistryEvent } from './model'

export class RegistryEventSourceError extends Schema.TaggedErrorClass<RegistryEventSourceError>()(
  'RegistryEventSourceError',
  {
    cause: Schema.Defect(),
    message: Schema.String,
    operation: Schema.String,
  }
) {}

export interface RegistryEventDelivery {
  readonly ack: Effect.Effect<void, RegistryEventSourceError>
  readonly deliveryCount: number
  readonly event: RegistryEvent
  readonly nak: (
    delayMilliseconds: number
  ) => Effect.Effect<void, RegistryEventSourceError>
  readonly sequence: number
  readonly term: (
    reason: string
  ) => Effect.Effect<void, RegistryEventSourceError>
  readonly working: Effect.Effect<void, RegistryEventSourceError>
}

export interface RegistryEventSourceShape {
  readonly deliveries: Stream.Stream<
    RegistryEventDelivery,
    RegistryEventSourceError
  >
  readonly maxDeliver: number
  readonly maxInFlight: number
}

export class RegistryEventSource extends Context.Service<
  RegistryEventSource,
  RegistryEventSourceShape
>()('@cv/application-registry-events/RegistryEventSource') {}
