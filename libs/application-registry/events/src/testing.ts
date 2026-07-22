import { Context, Effect, Layer, Ref } from 'effect'

import type { RegistryEvent } from './model'
import { RegistryEventPublisher } from './publisher'

export interface RegistryEventRecorderShape {
  readonly clear: () => Effect.Effect<void>
  readonly events: () => Effect.Effect<ReadonlyArray<RegistryEvent>>
}

export class RegistryEventRecorder extends Context.Service<
  RegistryEventRecorder,
  RegistryEventRecorderShape
>()('@cv/application-registry-events/RegistryEventRecorder') {}

export const RegistryEventPublisherRecording = Layer.effectContext(
  Effect.gen(function* () {
    const recorded = yield* Ref.make<ReadonlyArray<RegistryEvent>>([])
    const service = RegistryEventRecorder.of({
      clear: Effect.fn('RegistryEventRecorder.clear')(() =>
        Ref.set(recorded, [])
      ),
      events: Effect.fn('RegistryEventRecorder.events')(() =>
        Ref.get(recorded)
      ),
    })
    const publisher = RegistryEventPublisher.of({
      publish: Effect.fn('RegistryEventPublisher.record')((event) =>
        Ref.update(recorded, (events) => [...events, event])
      ),
    })

    return Context.empty().pipe(
      Context.add(RegistryEventPublisher, publisher),
      Context.add(RegistryEventRecorder, service)
    )
  })
)
