import {
  CvLinkResponseSchema,
  PdfJobResponseSchema,
} from '@cv/application-registry-api-contract'
import { pdfGenerationFailedDisableReason } from '@cv/application-registry-entity'
import { Cause, Effect, Exit, Option, Schedule } from 'effect'
import * as Reactivity from 'effect/unstable/reactivity/Reactivity'
import * as Activity from 'effect/unstable/workflow/Activity'
import * as Workflow from 'effect/unstable/workflow/Workflow'

import { publicationMutationReactivityKeys } from '../data/keys'
import { PreparationRepository } from '../data/repository'
import {
  type CvPublicationStage,
  CvPublicationWorkflowError,
  type CvPublicationWorkflowInput,
  type CvPublicationWorkflowResult,
  PublishCvWorkflow,
} from './domain'
import { CvPublicationProgress } from './progress'

const stopActivityInterruptRetries = Schedule.recurs(0).pipe(
  Schedule.setInputType<Cause.Cause<unknown>>()
)

const messageFromUnknown = (cause: unknown): string =>
  Cause.prettyErrors(Cause.fail(cause))[0]?.message ?? String(cause)

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

const executeCvPublication = Effect.fn('PublishCv.run')(
  function* (input: CvPublicationWorkflowInput) {
    const repository = yield* PreparationRepository
    const progress = yield* CvPublicationProgress

    yield* progress.publishing(input.runId)
    const link = yield* Activity.make({
      name: 'enable-cv-page',
      success: CvLinkResponseSchema,
      error: CvPublicationWorkflowError,
      interruptRetryPolicy: stopActivityInterruptRetries,
      execute: repository
        .setPublicationAvailability({
          applicationId: input.applicationId,
          entryId: input.entry.id,
          input: {
            enabled: true,
            expectedPublicationVersion: input.expectedPublicationVersion,
          },
        })
        .pipe(mapRepositoryError('enable-page')),
    }).pipe(
      Workflow.withCompensation((enabledLink) =>
        repository
          .setPublicationAvailability({
            applicationId: input.applicationId,
            entryId: input.entry.id,
            input: {
              enabled: false,
              expectedPublicationVersion: enabledLink.publicationVersion,
              reason: pdfGenerationFailedDisableReason,
            },
          })
          .pipe(
            Effect.asVoid,
            Effect.ignoreCause({
              log: 'Warn',
              message:
                'Could not disable the CV publication after PDF generation failed to start.',
            })
          )
      )
    )

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
          },
        })
        .pipe(mapRepositoryError('start-pdf')),
    })

    const result = {
      applicationId: input.applicationId,
      entryId: input.entry.id,
      job: started,
      link,
      pdfStartError: null,
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
