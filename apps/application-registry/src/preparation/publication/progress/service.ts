import type { CvLink } from '@cv/application-registry-entity'
import { Effect, Layer, SubscriptionRef } from 'effect'

import type {
  CvPublicationWorkflowInput,
  CvPublicationWorkflowResult,
} from '../domain'
import { CvPublicationWorkflowError } from '../domain'
import type { CvPublicationCancellationClaim, CvPublicationRuns } from './model'
import { CvPublicationProgress } from './model'
import {
  isActivePublicationRun,
  publicationRunIdentity,
  updatePublicationRun,
} from './state'

export const cvPublicationProgressLayer = Layer.effect(
  CvPublicationProgress,
  Effect.gen(function* () {
    const runs = yield* SubscriptionRef.make<CvPublicationRuns>(new Map())

    const reserve = Effect.fn('CvPublicationProgress.reserve')(function* (
      input: CvPublicationWorkflowInput,
      executionId: string
    ) {
      const conflict = yield* SubscriptionRef.modify(runs, (current) => {
        if (current.has(input.runId)) {
          return [
            `Publication run ${input.runId} already exists.`,
            current,
          ] as const
        }
        const existing = [...current.values()].find(
          (run) =>
            (isActivePublicationRun(run) || run._tag === 'Cancelling') &&
            run.applicationId === input.applicationId &&
            run.entryId === input.entry.id
        )
        if (existing !== undefined) {
          return [
            `Publication run ${existing.runId} is already open for this CV entry.`,
            current,
          ] as const
        }
        const next = new Map(current)
        next.set(input.runId, {
          _tag: 'Queued',
          applicationId: input.applicationId,
          entryId: input.entry.id,
          executionId,
          message: 'Waiting to make the approved CV public.',
          runId: input.runId,
        })
        return [null, next] as const
      })
      if (conflict === null) return
      return yield* Effect.fail(
        new CvPublicationWorkflowError({
          message: conflict,
          stage: 'input',
        })
      )
    })

    const releaseReservation = Effect.fn(
      'CvPublicationProgress.releaseReservation'
    )(function* (runId: string) {
      yield* SubscriptionRef.update(runs, (current) => {
        const run = current.get(runId)
        if (run?._tag !== 'Queued') return current
        const next = new Map(current)
        next.delete(runId)
        return next
      })
    })

    const publishing = Effect.fn('CvPublicationProgress.publishing')(function* (
      runId: string
    ) {
      yield* SubscriptionRef.update(runs, (current) =>
        updatePublicationRun(current, runId, (run) =>
          run._tag !== 'Queued'
            ? run
            : {
                ...publicationRunIdentity(run),
                _tag: 'PublishingLink',
                message: 'Making the approved CV page public.',
              }
        )
      )
    })

    const startingPdf = Effect.fn('CvPublicationProgress.startingPdf')(
      function* (runId: string, link: CvLink) {
        yield* SubscriptionRef.update(runs, (current) =>
          updatePublicationRun(current, runId, (run) =>
            run._tag !== 'PublishingLink'
              ? run
              : {
                  ...publicationRunIdentity(run),
                  _tag: 'StartingPdf',
                  link,
                  message: 'CV page is public. Starting PDF generation.',
                }
          )
        )
      }
    )

    const complete = Effect.fn('CvPublicationProgress.complete')(function* (
      result: CvPublicationWorkflowResult
    ) {
      yield* SubscriptionRef.update(runs, (current) =>
        updatePublicationRun(current, result.runId, (run) =>
          run._tag !== 'StartingPdf'
            ? run
            : {
                ...publicationRunIdentity(run),
                _tag: 'Published',
                message:
                  result.job === null
                    ? 'The CV is public. PDF generation still needs to be started.'
                    : 'The CV is public and PDF generation has started.',
                result,
              }
        )
      )
    })

    const fail = Effect.fn('CvPublicationProgress.fail')(function* (
      runId: string,
      error: CvPublicationWorkflowError
    ) {
      yield* SubscriptionRef.update(runs, (current) =>
        updatePublicationRun(current, runId, (run) => {
          if (
            run._tag === 'Published' ||
            run._tag === 'Failed' ||
            run._tag === 'Cancelled'
          ) {
            return run
          }
          if (run._tag === 'Cancelling') {
            return {
              ...publicationRunIdentity(run),
              _tag: 'Cancelled',
              message: 'CV publication cancelled for this browser session.',
            }
          }
          return {
            ...publicationRunIdentity(run),
            _tag: 'Failed',
            error,
            message: 'CV publication failed.',
          }
        })
      )
    })

    const requestCancel = Effect.fn('CvPublicationProgress.requestCancel')(
      function* (runId: string, executionId: string) {
        return yield* SubscriptionRef.modify(runs, (current) => {
          const run = current.get(runId)
          if (
            run === undefined ||
            run.executionId !== executionId ||
            !isActivePublicationRun(run)
          ) {
            return [null, current] as const
          }
          const next = new Map(current)
          next.set(runId, {
            ...publicationRunIdentity(run),
            _tag: 'Cancelling',
            message: 'Cancelling CV publication for this browser session.',
            previous: run,
          })
          return [{ previous: run }, next] as const
        })
      }
    )

    const restoreCancellation = Effect.fn(
      'CvPublicationProgress.restoreCancellation'
    )(function* (
      runId: string,
      executionId: string,
      claim: CvPublicationCancellationClaim
    ) {
      yield* SubscriptionRef.update(runs, (current) =>
        updatePublicationRun(current, runId, (run) =>
          run._tag === 'Cancelling' && run.executionId === executionId
            ? claim.previous
            : run
        )
      )
    })

    const cancel = Effect.fn('CvPublicationProgress.cancel')(function* (
      runId: string
    ) {
      yield* SubscriptionRef.update(runs, (current) =>
        updatePublicationRun(current, runId, (run) =>
          !isActivePublicationRun(run) && run._tag !== 'Cancelling'
            ? run
            : {
                ...publicationRunIdentity(run),
                _tag: 'Cancelled',
                message: 'CV publication cancelled for this browser session.',
              }
        )
      )
    })

    return CvPublicationProgress.of({
      cancel,
      complete,
      fail,
      publishing,
      releaseReservation,
      requestCancel,
      reserve,
      restoreCancellation,
      runs,
      startingPdf,
    })
  })
)
