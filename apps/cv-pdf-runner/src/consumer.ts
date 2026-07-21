import {
  type PdfJobPermanentError,
  processPdfJobEffect,
  recordPdfJobFailureEffect,
  retryDelaySeconds,
  retryExhaustedError,
} from '@cv/application-registry-pdf-processing'
import {
  decodePdfQueueMessage,
  PdfQueue,
  type PdfQueueMessage,
} from '@cv/application-registry-pdf-queue'
import { Effect, Match, Option } from 'effect'

const recordAndFinish = (
  message: PdfQueueMessage,
  request: Parameters<typeof recordPdfJobFailureEffect>[0],
  error: PdfJobPermanentError
) =>
  recordPdfJobFailureEffect(request, error).pipe(
    Effect.matchEffect({
      onFailure: (recordError) =>
        Match.value(recordError).pipe(
          Match.tag('PdfJobPermanentError', (permanent) =>
            Effect.logWarning('PdfRunner.permanent_failure_not_recorded', {
              artifactId: request.artifactId,
              message: permanent.message,
            }).pipe(Effect.andThen(message.term(permanent.message)))
          ),
          Match.tag('PdfJobTransientError', (transient) =>
            Effect.logWarning('PdfRunner.failure_record_retrying', {
              artifactId: request.artifactId,
              message: transient.message,
            }).pipe(
              Effect.andThen(
                message.nak(
                  retryDelaySeconds(
                    message.deliveryCount,
                    transient.retryAfterSeconds
                  ) * 1_000
                )
              )
            )
          ),
          Match.exhaustive
        ),
      onSuccess: () => message.ack,
    })
  )

const processRequest = (
  message: PdfQueueMessage,
  request: Parameters<typeof processPdfJobEffect>[0],
  maxDeliver: number
) =>
  processPdfJobEffect(request).pipe(
    Effect.matchEffect({
      onFailure: (error) =>
        Match.value(error).pipe(
          Match.tag('PdfJobPermanentError', (permanent) =>
            recordAndFinish(message, request, permanent)
          ),
          Match.tag('PdfJobTransientError', (transient) =>
            message.deliveryCount >= maxDeliver
              ? recordAndFinish(message, request, retryExhaustedError())
              : Effect.logWarning('PdfRunner.job_retrying', {
                  artifactId: request.artifactId,
                  attempt: message.deliveryCount,
                  message: transient.message,
                }).pipe(
                  Effect.andThen(
                    message.nak(
                      retryDelaySeconds(
                        message.deliveryCount,
                        transient.retryAfterSeconds
                      ) * 1_000
                    )
                  )
                )
          ),
          Match.exhaustive
        ),
      onSuccess: () => message.ack,
    })
  )

const withHeartbeat = <A, E, R>(
  message: PdfQueueMessage,
  milliseconds: number,
  effect: Effect.Effect<A, E, R>
) =>
  Effect.scoped(
    Effect.gen(function* () {
      yield* Effect.sleep(milliseconds).pipe(
        Effect.andThen(message.working),
        Effect.forever,
        Effect.forkScoped
      )
      return yield* effect
    })
  )

export const consumePdfQueueMessage = (
  message: PdfQueueMessage,
  heartbeatMilliseconds: number,
  maxDeliver: number
) =>
  decodePdfQueueMessage(message.bytes).pipe(
    Effect.matchEffect({
      onFailure: (error) =>
        Effect.logWarning('PdfRunner.invalid_message', {
          parseError: error.message,
          sequence: message.sequence,
        }).pipe(Effect.andThen(message.term('Invalid PDF queue message.'))),
      onSuccess: (request) =>
        withHeartbeat(
          message,
          heartbeatMilliseconds,
          processRequest(message, request, maxDeliver)
        ),
    })
  )

export const runPdfQueue = (heartbeatMilliseconds: number) =>
  Effect.gen(function* () {
    const queue = yield* PdfQueue
    yield* queue.take.pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.void,
          onSome: (message) =>
            consumePdfQueueMessage(
              message,
              heartbeatMilliseconds,
              queue.configuration.maxDeliver
            ),
        })
      ),
      Effect.forever
    )
  })
