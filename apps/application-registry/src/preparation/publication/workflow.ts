import {
  CvLinkResponseSchema,
  GeneratedArtifactResponseSchema,
  type PdfJobResponse,
  PdfJobResponseSchema,
} from '@cv/application-registry-api-contract'
import { Cause, Effect, Exit, Option, Schedule, Schema } from 'effect'
import * as Reactivity from 'effect/unstable/reactivity/Reactivity'
import * as Activity from 'effect/unstable/workflow/Activity'

import { publicationMutationReactivityKeys } from '../data/keys'
import { PreparationRepository } from '../data/repository'
import {
  type CvPublicationStage,
  CvPublicationWorkflowError,
  type CvPublicationWorkflowInput,
  type CvPublicationWorkflowResult,
  PublishCvWorkflow,
  verifiedPublicationResult,
} from './domain'
import { CvPublicationProgress } from './progress'

const PublishedCvStateSchema = Schema.Struct({
  artifact: GeneratedArtifactResponseSchema,
  link: CvLinkResponseSchema,
})

const stopActivityInterruptRetries = Schedule.recurs(0).pipe(
  Schedule.setInputType<Cause.Cause<unknown>>()
)

export const cvPublicationPollSchedule = Schedule.spaced('1500 millis').pipe(
  Schedule.upTo({ times: 319 })
)

export const cvPublicationReadRetrySchedule = Schedule.exponential(
  '250 millis'
).pipe(Schedule.upTo({ times: 2 }))

const messageFromUnknown = (cause: unknown): string => {
  if (
    typeof cause === 'object' &&
    cause !== null &&
    'message' in cause &&
    typeof cause.message === 'string'
  ) {
    return cause.message
  }
  return String(cause)
}

const publicationError = (
  stage: CvPublicationStage,
  cause: unknown
): CvPublicationWorkflowError =>
  cause instanceof CvPublicationWorkflowError
    ? cause
    : new CvPublicationWorkflowError({
        message: messageFromUnknown(cause),
        stage,
      })

const mapRepositoryError = (stage: CvPublicationStage) =>
  Effect.mapError((cause: unknown) => publicationError(stage, cause))

const invalidatePublication = (input: CvPublicationWorkflowInput) =>
  Reactivity.invalidate(
    publicationMutationReactivityKeys(input.applicationId, input.entry.id)
  )

const terminalPdfStatus = (status: PdfJobResponse['status']): boolean =>
  status === 'ready' || status === 'failed'

const executeCvPublication = Effect.fn('PublishCv.run')(
  function* (input: CvPublicationWorkflowInput) {
    const repository = yield* PreparationRepository
    const progress = yield* CvPublicationProgress

    yield* progress.publishing(input.runId)
    const link = yield* Activity.make({
      name: 'publish-cv-link',
      success: CvLinkResponseSchema,
      error: CvPublicationWorkflowError,
      interruptRetryPolicy: stopActivityInterruptRetries,
      execute: repository
        .publishCv({
          applicationId: input.applicationId,
          entry: input.entry,
          publicBaseUrl: input.publicBaseUrl,
        })
        .pipe(mapRepositoryError('publish-link')),
    })

    yield* progress.startingPdf(input.runId, link)
    const started = yield* Activity.make({
      name: 'start-pdf-generation',
      success: PdfJobResponseSchema,
      error: CvPublicationWorkflowError,
      interruptRetryPolicy: stopActivityInterruptRetries,
      execute: repository
        .startPdfGeneration({
          applicationId: input.applicationId,
          entryId: input.entry.id,
          input: {
            expectedPublicationVersion: link.publicationVersion,
            requestId: input.runId,
            rendererVersion: input.rendererVersion,
          },
        })
        .pipe(mapRepositoryError('start-pdf')),
    }).pipe(
      Effect.catch((startError) =>
        Effect.gen(function* () {
          const compensation = yield* Effect.exit(
            Activity.make({
              name: 'disable-cv-link-after-pdf-start-failure',
              success: CvLinkResponseSchema,
              error: CvPublicationWorkflowError,
              interruptRetryPolicy: stopActivityInterruptRetries,
              execute: repository
                .setPublicationAvailability({
                  applicationId: input.applicationId,
                  entryId: input.entry.id,
                  input: {
                    enabled: false,
                    expectedPublicationVersion: link.publicationVersion,
                    reason: 'PDF generation could not be started.',
                  },
                })
                .pipe(mapRepositoryError('compensation')),
            })
          )
          if (Exit.isFailure(compensation)) {
            return yield* Effect.fail(
              new CvPublicationWorkflowError({
                message: `PDF generation failed to start, and the new public link could not be disabled: ${Cause.pretty(compensation.cause)}`,
                stage: 'compensation',
              })
            )
          }
          return yield* Effect.fail(startError)
        })
      )
    )

    yield* progress.polling(input.runId, link, started)
    let pollAttempt = 0
    const readNext = Effect.suspend(() => {
      const attempt = pollAttempt
      pollAttempt += 1
      return Activity.make({
        name: `poll-pdf-job/${attempt}`,
        success: PdfJobResponseSchema,
        error: CvPublicationWorkflowError,
        interruptRetryPolicy: stopActivityInterruptRetries,
        execute: repository
          .readPdfJob({
            applicationId: input.applicationId,
            entryId: input.entry.id,
            jobId: started.jobId,
          })
          .pipe(
            mapRepositoryError('poll-pdf'),
            Effect.retry(cvPublicationReadRetrySchedule)
          ),
      }).pipe(Effect.tap((job) => progress.polling(input.runId, link, job)))
    })

    const finished = terminalPdfStatus(started.status)
      ? started
      : yield* readNext.pipe(
          Effect.repeat({
            schedule: cvPublicationPollSchedule,
            while: (job) => !terminalPdfStatus(job.status),
          })
        )

    if (finished.status === 'failed') {
      return yield* Effect.fail(
        new CvPublicationWorkflowError({
          message: finished.errorMessage ?? 'PDF generation failed.',
          stage: 'poll-pdf',
        })
      )
    }
    if (finished.status !== 'ready') {
      return yield* Effect.fail(
        new CvPublicationWorkflowError({
          message:
            'PDF generation is still running. Publishing can be started again safely.',
          stage: 'poll-pdf',
        })
      )
    }
    const artifactId = finished.jobId

    yield* progress.verifying(input.runId, link, finished)
    const publication = yield* Activity.make({
      name: 'verify-current-artifact',
      success: PublishedCvStateSchema,
      error: CvPublicationWorkflowError,
      interruptRetryPolicy: stopActivityInterruptRetries,
      execute: repository
        .loadPublishedCvState({
          applicationId: input.applicationId,
          entryId: input.entry.id,
          rendererVersion: input.rendererVersion,
        })
        .pipe(
          mapRepositoryError('verify-artifact'),
          Effect.flatMap((state) =>
            state !== null &&
            verifiedPublicationResult(
              input,
              state.link,
              state.artifact,
              artifactId
            )
              ? Effect.succeed(state)
              : Effect.fail(
                  new CvPublicationWorkflowError({
                    message:
                      'The current PDF does not match the newly published CV revision and link.',
                    stage: 'verify-artifact',
                  })
                )
          )
        ),
    })

    const result = {
      applicationId: input.applicationId,
      artifact: publication.artifact,
      entryId: input.entry.id,
      link: publication.link,
      runId: input.runId,
    } satisfies CvPublicationWorkflowResult
    yield* progress.complete(result)
    yield* invalidatePublication(input)
    return result
  },
  (effect, input) =>
    Effect.gen(function* () {
      const progress = yield* CvPublicationProgress
      return yield* effect.pipe(
        Effect.onExit((exit) => {
          if (Exit.isSuccess(exit)) return Effect.void
          const settleProgress = Cause.hasInterruptsOnly(exit.cause)
            ? progress.cancel(input.runId)
            : (() => {
                const typed = Cause.findErrorOption(exit.cause)
                return progress.fail(
                  input.runId,
                  Option.isSome(typed)
                    ? typed.value
                    : new CvPublicationWorkflowError({
                        message: Cause.pretty(exit.cause),
                        stage: 'input',
                      })
                )
              })()
          return settleProgress.pipe(
            Effect.andThen(invalidatePublication(input))
          )
        })
      )
    })
)

export const cvPublicationWorkflowLayer =
  PublishCvWorkflow.toLayer(executeCvPublication)
