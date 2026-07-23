import {
  type CvPublicationChangedEvent,
  isCvPublicationChangedEvent,
  type RegistryEventDelivery,
  RegistryEventSource,
} from '@cv/application-registry-events'
import { Effect, Match, Stream } from 'effect'

import { CacheInvalidator } from './cloudflare'

const retryDelayMilliseconds = (deliveryCount: number) =>
  Math.min(15 * 60_000, 20_000 * 2 ** Math.max(0, deliveryCount - 1))

const terminate = (
  delivery: RegistryEventDelivery,
  event: CvPublicationChangedEvent,
  error: { readonly message: string }
) =>
  Effect.logError('CvCacheInvalidator.event_terminated', {
    attempt: delivery.deliveryCount,
    eventId: event.eventId,
    message: error.message,
  }).pipe(Effect.andThen(delivery.term(error.message)))

const consumePublicationChanged = (
  delivery: RegistryEventDelivery,
  event: CvPublicationChangedEvent,
  maxDeliver: number
) =>
  CacheInvalidator.use((invalidator) => {
    return invalidator.invalidate().pipe(
      Effect.matchEffect({
        onFailure: (error) =>
          Match.value(error).pipe(
            Match.tag('CacheInvalidationPermanentError', (permanent) =>
              terminate(delivery, event, permanent)
            ),
            Match.tag('CacheInvalidationTransientError', (transient) =>
              delivery.deliveryCount >= maxDeliver
                ? terminate(delivery, event, transient)
                : Effect.logWarning('CvCacheInvalidator.event_retrying', {
                    attempt: delivery.deliveryCount,
                    eventId: event.eventId,
                    message: transient.message,
                  }).pipe(
                    Effect.andThen(
                      delivery.nak(
                        retryDelayMilliseconds(delivery.deliveryCount)
                      )
                    )
                  )
            ),
            Match.exhaustive
          ),
        onSuccess: () => delivery.ack,
      })
    )
  })

export const consumeRegistryEvent = (
  delivery: RegistryEventDelivery,
  maxDeliver: number
) =>
  isCvPublicationChangedEvent(delivery.event)
    ? consumePublicationChanged(delivery, delivery.event, maxDeliver)
    : delivery.ack

export const runCacheInvalidationConsumer = Effect.gen(function* () {
  const source = yield* RegistryEventSource
  yield* source.deliveries.pipe(
    Stream.mapEffect(
      (delivery) => consumeRegistryEvent(delivery, source.maxDeliver),
      {
        concurrency: source.maxInFlight,
        unordered: true,
      }
    ),
    Stream.runDrain
  )
})
