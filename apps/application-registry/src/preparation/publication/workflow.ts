import { CvLinkResponseSchema } from '@cv/application-registry-api-contract'
import {
  Cause,
  Effect,
  Exit,
  Match,
  Option,
  Predicate,
  Schedule,
  Schema,
} from 'effect'
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
} from './domain'
import { CvPublicationProgress } from './progress'

const stopActivityInterruptRetries = Schedule.recurs(0).pipe(
  Schedule.setInputType<Cause.Cause<unknown>>()
)

const messageFromUnknown = (cause: unknown): string =>
  Match.value(cause).pipe(
    Match.when(Predicate.isError, (error) => error.message),
    Match.orElse(String)
  )

const publicationError = (
  stage: CvPublicationStage,
  cause: unknown
): CvPublicationWorkflowError =>
  Match.value(cause).pipe(
    Match.when(Schema.is(CvPublicationWorkflowError), (error) => error),
    Match.orElse(
      (cause) =>
        new CvPublicationWorkflowError({
          message: messageFromUnknown(cause),
          stage,
        })
    )
  )

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
          operationId: input.runId,
          input: {
            enabled: true,
            expectedPublicationVersion: input.expectedPublicationVersion,
          },
        })
        .pipe(mapRepositoryError('enable-page')),
    })

    const result = {
      applicationId: input.applicationId,
      entryId: input.entry.id,
      link,
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
