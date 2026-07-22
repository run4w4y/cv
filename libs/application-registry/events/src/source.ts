import { Context, type Effect, Schema, type Stream } from 'effect'

import type { RegistryEvent } from './model'

export interface RegistryEventDelivery {
  readonly ack: Effect.Effect<void>
  readonly deliveryCount: number
  readonly event: RegistryEvent
  readonly nak: (delayMilliseconds: number) => Effect.Effect<void>
  readonly sequence: number
  readonly term: (reason: string) => Effect.Effect<void>
  readonly working: Effect.Effect<void>
}

export class RegistryEventSourceError extends Schema.TaggedErrorClass<RegistryEventSourceError>()(
  'RegistryEventSourceError',
  {
    cause: Schema.Defect(),
    message: Schema.String,
    operation: Schema.String,
  }
) {}

export interface RegistryEventSourceShape {
  readonly deliveries: Stream.Stream<
    RegistryEventDelivery,
    RegistryEventSourceError
  >
  readonly maxDeliver: number
}

export class RegistryEventSource extends Context.Service<
  RegistryEventSource,
  RegistryEventSourceShape
>()('@cv/application-registry-events/RegistryEventSource') {}
