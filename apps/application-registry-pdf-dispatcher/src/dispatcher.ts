import type { PdfGenerationRequested } from '@cv/application-registry-api-contract'
import { PdfQueue } from '@cv/application-registry-pdf-queue'
import {
  PdfDispatchesService,
  type PdfGenerationDispatch,
} from '@cv/application-registry-service'
import { Effect, Predicate } from 'effect'

export interface PdfDispatchSummary {
  readonly attempted: number
  readonly failed: number
  readonly published: number
}

const messageOf = (cause: unknown) =>
  (Predicate.isError(cause) ? cause.message : String(cause)).slice(0, 2_000)

const toRequest = (
  dispatch: PdfGenerationDispatch
): Effect.Effect<PdfGenerationRequested, Error> =>
  dispatch.messageVersion === 1
    ? Effect.succeed({
        _tag: 'PdfGenerationRequested',
        applicationId: dispatch.applicationId,
        artifactId: dispatch.artifactId,
        entryId: dispatch.contentEntryId,
        version: 1,
      })
    : Effect.fail(
        new Error(
          `Unsupported PDF queue message version ${dispatch.messageVersion}.`
        )
      )

export const dispatchPendingPdfJobs = Effect.fn(
  'PdfDispatcher.dispatchPending'
)(function* (limit: number) {
  const dispatches = yield* PdfDispatchesService
  const queue = yield* PdfQueue
  const pending = yield* dispatches.pending(limit)
  const outcomes = yield* Effect.forEach(
    pending,
    (dispatch) =>
      toRequest(dispatch).pipe(
        Effect.flatMap(queue.publish),
        Effect.matchEffect({
          onFailure: (cause) =>
            dispatches.markFailed(dispatch.artifactId, messageOf(cause)).pipe(
              Effect.andThen(
                Effect.logWarning('PdfDispatcher.publish_failed', {
                  artifactId: dispatch.artifactId,
                  message: messageOf(cause),
                })
              ),
              Effect.as(false)
            ),
          onSuccess: () =>
            dispatches.markPublished(dispatch.artifactId).pipe(Effect.as(true)),
        })
      ),
    { concurrency: 1 }
  )
  const published = outcomes.filter(Boolean).length

  return {
    attempted: outcomes.length,
    failed: outcomes.length - published,
    published,
  } satisfies PdfDispatchSummary
})
