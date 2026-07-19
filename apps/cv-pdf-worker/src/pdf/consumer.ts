import type { Message, MessageBatch } from '@cloudflare/workers-types'
import {
  type PdfGenerationRequested,
  PdfGenerationRequestedSchema,
} from '@cv/application-registry-api-contract'
import { Effect, Layer, Match, Schema } from 'effect'

import type { PdfWorkerEnv } from '../worker/types'
import type { PdfJobPermanentError } from './model'
import {
  processPdfJobEffect,
  recordPdfJobFailureEffect,
  retryExhaustedError,
} from './processor'
import { makePdfArtifactPersistenceLive, makePdfRendererLive } from './services'

export const retryDelaySeconds = (
  attempts: number,
  retryAfterSeconds?: number
): number =>
  retryAfterSeconds ?? Math.min(300, 20 * 2 ** Math.max(0, attempts - 1))

const acknowledge = (message: Message<unknown>) =>
  Effect.sync(() => message.ack())

const retry = (message: Message<unknown>, retryAfterSeconds?: number) =>
  Effect.sync(() =>
    message.retry({
      delaySeconds: retryDelaySeconds(message.attempts, retryAfterSeconds),
    })
  )

const recordAndAcknowledge = (
  message: Message<unknown>,
  request: PdfGenerationRequested,
  error: PdfJobPermanentError
) =>
  recordPdfJobFailureEffect(request, error).pipe(
    Effect.catchTag('PdfJobPermanentError', (recordError) =>
      Effect.logWarning('PdfQueue.permanent_failure_not_recorded', {
        artifactId: request.artifactId,
        message: recordError.message,
      })
    ),
    Effect.matchEffect({
      onFailure: (transient) =>
        Effect.logWarning('PdfQueue.failure_record_retrying', {
          artifactId: request.artifactId,
          message: transient.message,
        }).pipe(Effect.andThen(retry(message, transient.retryAfterSeconds))),
      onSuccess: () => acknowledge(message),
    })
  )

const consumeRequest = (
  message: Message<unknown>,
  request: PdfGenerationRequested,
  deadLetter: boolean
) =>
  deadLetter
    ? recordAndAcknowledge(message, request, retryExhaustedError())
    : processPdfJobEffect(request).pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            Match.value(error).pipe(
              Match.tag('PdfJobPermanentError', (permanent) =>
                recordAndAcknowledge(message, request, permanent)
              ),
              Match.tag('PdfJobTransientError', (transient) =>
                Effect.logWarning('PdfQueue.job_retrying', {
                  artifactId: request.artifactId,
                  attempt: message.attempts,
                  message: transient.message,
                }).pipe(
                  Effect.andThen(retry(message, transient.retryAfterSeconds))
                )
              ),
              Match.exhaustive
            ),
          onSuccess: () => acknowledge(message),
        })
      )

export const consumePdfMessageEffect = (
  message: Message<unknown>,
  deadLetter: boolean
) =>
  Schema.decodeUnknownEffect(PdfGenerationRequestedSchema)(message.body).pipe(
    Effect.matchEffect({
      onFailure: (error) =>
        Effect.logWarning('PdfQueue.invalid_message', {
          messageId: message.id,
          parseError: String(error),
        }).pipe(Effect.andThen(acknowledge(message))),
      onSuccess: (request) => consumeRequest(message, request, deadLetter),
    })
  )

export const runPdfQueue = (
  environment: PdfWorkerEnv,
  batch: MessageBatch<unknown>
): Promise<void> => {
  const deadLetter = batch.queue === environment.CV_PDF_DLQ_NAME
  const infrastructure = Layer.merge(
    makePdfArtifactPersistenceLive(environment),
    makePdfRendererLive(environment.BROWSER)
  )

  return Effect.forEach(
    batch.messages,
    (message) => consumePdfMessageEffect(message, deadLetter),
    { concurrency: 1, discard: true }
  ).pipe(Effect.provide(infrastructure), Effect.runPromise)
}
