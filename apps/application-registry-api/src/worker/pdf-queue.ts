import {
  PdfGenerationRequestedSchema,
  type PdfJobResponse,
} from '@cv/application-registry-api-contract'
import type { GeneratedArtifact } from '@cv/application-registry-entity'
import { PdfArtifactsService } from '@cv/application-registry-service'
import { Effect, Schema } from 'effect'

import { makeRegistryServiceLayer } from '../layers/registry'
import { WorkerEnv } from './bindings'
import type { ApplicationRegistryEnv } from './types'

export class PdfQueueDispatchError extends Schema.TaggedErrorClass<PdfQueueDispatchError>()(
  'PdfQueueDispatchError',
  {
    artifactId: Schema.String,
    cause: Schema.Defect(),
    message: Schema.String,
  }
) {}

const messageOf = (cause: unknown): string =>
  (cause instanceof Error ? cause.message : String(cause)).slice(0, 2_000)

export const pdfJobResponse = (
  artifact: GeneratedArtifact
): PdfJobResponse => ({
  errorCode: artifact.errorCode,
  errorMessage: artifact.errorMessage,
  jobId: artifact.id,
  status: artifact.status,
})

export const dispatchPdfJob = Effect.fn('PdfQueue.dispatchJob')(function* (
  artifactId: string
) {
  const artifacts = yield* PdfArtifactsService
  const dispatch = yield* artifacts.findPendingDispatch(artifactId)
  if (dispatch === undefined) return false

  const environment = yield* WorkerEnv
  const queue = environment.CV_PDF_QUEUE
  if (queue === undefined) {
    return yield* new PdfQueueDispatchError({
      artifactId,
      cause: new Error('CV_PDF_QUEUE is not configured.'),
      message: 'The CV PDF generation Queue binding is not configured.',
    })
  }

  const message = PdfGenerationRequestedSchema.make({
    applicationId: dispatch.applicationId,
    artifactId: dispatch.artifactId,
    entryId: dispatch.contentEntryId,
    version: 1,
  })

  yield* Effect.tryPromise({
    try: () => queue.send(message, { contentType: 'json' }),
    catch: (cause) =>
      new PdfQueueDispatchError({
        artifactId,
        cause,
        message: `Failed to enqueue PDF job ${artifactId}: ${messageOf(cause)}`,
      }),
  }).pipe(
    Effect.tapError((error) =>
      artifacts.markDispatchFailed(artifactId, error.message).pipe(
        Effect.catch((recordError) =>
          Effect.logWarning('PdfQueue.dispatch_failure_record_failed', {
            artifactId,
            message: recordError.message,
          })
        )
      )
    )
  )

  yield* artifacts.markDispatched(artifactId)
  return true
})

export const dispatchPendingPdfJobsEffect = Effect.fn(
  'PdfQueue.dispatchPending'
)(function* (limit = 25) {
  const artifacts = yield* PdfArtifactsService
  const pending = yield* artifacts.pendingDispatches(limit)

  yield* Effect.forEach(
    pending,
    (dispatch) =>
      dispatchPdfJob(dispatch.artifactId).pipe(
        Effect.catch((error) =>
          Effect.logWarning('PdfQueue.dispatch_failed', {
            artifactId: dispatch.artifactId,
            message: error.message,
          })
        )
      ),
    { concurrency: 1, discard: true }
  )

  return pending.length
})

export const runScheduledPdfDispatches = (
  environment: ApplicationRegistryEnv
) =>
  dispatchPendingPdfJobsEffect().pipe(
    Effect.provide(makeRegistryServiceLayer(environment)),
    Effect.provide(WorkerEnv.context(environment)),
    Effect.runPromise
  )
