import {
  isPdfGenerationTriggerEvent,
  type PdfGenerationTriggerEvent,
  type RegistryEventDelivery,
  RegistryEventSource,
} from '@cv/application-registry-events'
import {
  type PdfGenerationPermanentError,
  processPdfEvent,
  recordPdfGenerationFailure,
  retryDelaySeconds,
  retryExhaustedError,
} from '@cv/application-registry-pdf-processing'
import { Effect, Match, Stream } from 'effect'

const recordAndFinish = (
  delivery: RegistryEventDelivery,
  event: PdfGenerationTriggerEvent,
  error: PdfGenerationPermanentError
) =>
  recordPdfGenerationFailure(event, error).pipe(
    Effect.matchEffect({
      onFailure: (recordError) =>
        Match.value(recordError).pipe(
          Match.tag('PdfGenerationPermanentError', (permanent) =>
            Effect.logWarning('PdfWorker.permanent_failure_not_recorded', {
              eventId: event.eventId,
              message: permanent.message,
            }).pipe(Effect.andThen(delivery.term(permanent.message)))
          ),
          Match.tag('PdfGenerationTransientError', (transient) =>
            Effect.logWarning('PdfWorker.failure_record_retrying', {
              eventId: event.eventId,
              message: transient.message,
            }).pipe(
              Effect.andThen(
                delivery.nak(
                  retryDelaySeconds(
                    delivery.deliveryCount,
                    transient.retryAfterSeconds
                  ) * 1_000
                )
              )
            )
          ),
          Match.exhaustive
        ),
      onSuccess: () => delivery.ack,
    })
  )

const processEvent = (
  delivery: RegistryEventDelivery,
  event: PdfGenerationTriggerEvent,
  maxDeliver: number
) =>
  processPdfEvent(event).pipe(
    Effect.matchEffect({
      onFailure: (error) =>
        Match.value(error).pipe(
          Match.tag('PdfGenerationPermanentError', (permanent) =>
            recordAndFinish(delivery, event, permanent)
          ),
          Match.tag('PdfGenerationTransientError', (transient) =>
            delivery.deliveryCount >= maxDeliver
              ? recordAndFinish(delivery, event, retryExhaustedError())
              : Effect.logWarning('PdfWorker.event_retrying', {
                  attempt: delivery.deliveryCount,
                  eventId: event.eventId,
                  message: transient.message,
                }).pipe(
                  Effect.andThen(
                    delivery.nak(
                      retryDelaySeconds(
                        delivery.deliveryCount,
                        transient.retryAfterSeconds
                      ) * 1_000
                    )
                  )
                )
          ),
          Match.exhaustive
        ),
      onSuccess: () => delivery.ack,
    })
  )

const withHeartbeat = <A, E, R>(
  delivery: RegistryEventDelivery,
  milliseconds: number,
  effect: Effect.Effect<A, E, R>
) =>
  effect.pipe(
    Effect.raceFirst(
      Effect.sleep(milliseconds).pipe(
        Effect.andThen(delivery.working),
        Effect.forever
      )
    )
  )

export const consumeRegistryEvent = (
  delivery: RegistryEventDelivery,
  heartbeatMilliseconds: number,
  maxDeliver: number
) =>
  isPdfGenerationTriggerEvent(delivery.event)
    ? withHeartbeat(
        delivery,
        heartbeatMilliseconds,
        processEvent(delivery, delivery.event, maxDeliver)
      )
    : delivery.ack

export const runPdfEventConsumer = (heartbeatMilliseconds: number) =>
  Effect.gen(function* () {
    const source = yield* RegistryEventSource
    yield* source.deliveries.pipe(
      Stream.runForEach((delivery) =>
        consumeRegistryEvent(delivery, heartbeatMilliseconds, source.maxDeliver)
      )
    )
  })
