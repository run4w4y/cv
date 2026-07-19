import type { PdfJobResponse } from '@cv/application-registry-api-contract'
import type { CvLink } from '@cv/application-registry-entity'
import { Context, Effect, Layer, SubscriptionRef } from 'effect'

import type {
  ActiveCvPublicationRun,
  CvPublicationRun,
  CvPublicationWorkflowInput,
  CvPublicationWorkflowResult,
} from './domain'
import { CvPublicationWorkflowError } from './domain'

export type CvPublicationRuns = ReadonlyMap<string, CvPublicationRun>

export type CvPublicationCancellationClaim = {
  readonly previous: ActiveCvPublicationRun
}

export type CvPublicationProgressService = {
  readonly cancel: (runId: string) => Effect.Effect<void>
  readonly complete: (
    result: CvPublicationWorkflowResult
  ) => Effect.Effect<void>
  readonly fail: (
    runId: string,
    error: CvPublicationWorkflowError
  ) => Effect.Effect<void>
  readonly polling: (
    runId: string,
    link: CvLink,
    job: PdfJobResponse
  ) => Effect.Effect<void>
  readonly publishing: (runId: string) => Effect.Effect<void>
  readonly releaseReservation: (runId: string) => Effect.Effect<void>
  readonly requestCancel: (
    runId: string,
    executionId: string
  ) => Effect.Effect<CvPublicationCancellationClaim | null>
  readonly reserve: (
    input: CvPublicationWorkflowInput,
    executionId: string
  ) => Effect.Effect<void, CvPublicationWorkflowError>
  readonly restoreCancellation: (
    runId: string,
    executionId: string,
    claim: CvPublicationCancellationClaim
  ) => Effect.Effect<void>
  readonly runs: SubscriptionRef.SubscriptionRef<CvPublicationRuns>
  readonly startingPdf: (runId: string, link: CvLink) => Effect.Effect<void>
  readonly verifying: (
    runId: string,
    link: CvLink,
    job: PdfJobResponse
  ) => Effect.Effect<void>
}

export class CvPublicationProgress extends Context.Service<
  CvPublicationProgress,
  CvPublicationProgressService
>()('@cv/application-registry/CvPublicationProgress') {}

const activeTags = new Set<CvPublicationRun['_tag']>([
  'Queued',
  'PublishingLink',
  'StartingPdf',
  'PollingPdf',
  'VerifyingArtifact',
])

const isActive = (run: CvPublicationRun): run is ActiveCvPublicationRun =>
  activeTags.has(run._tag)

const updateRun = (
  runs: CvPublicationRuns,
  runId: string,
  update: (run: CvPublicationRun) => CvPublicationRun
): CvPublicationRuns => {
  const run = runs.get(runId)
  if (run === undefined) return runs
  const next = new Map(runs)
  next.set(runId, update(run))
  return next
}

const common = (run: CvPublicationRun) => ({
  applicationId: run.applicationId,
  entryId: run.entryId,
  executionId: run.executionId,
  rendererVersion: run.rendererVersion,
  runId: run.runId,
})

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
            (isActive(run) || run._tag === 'Cancelling') &&
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
          message: 'Waiting to publish the approved CV.',
          rendererVersion: input.rendererVersion,
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
        updateRun(current, runId, (run) =>
          run._tag !== 'Queued'
            ? run
            : {
                ...common(run),
                _tag: 'PublishingLink',
                message: 'Publishing a link for the approved CV revision.',
              }
        )
      )
    })

    const startingPdf = Effect.fn('CvPublicationProgress.startingPdf')(
      function* (runId: string, link: CvLink) {
        yield* SubscriptionRef.update(runs, (current) =>
          updateRun(current, runId, (run) =>
            run._tag !== 'PublishingLink'
              ? run
              : {
                  ...common(run),
                  _tag: 'StartingPdf',
                  link,
                  message: 'Public link ready. Starting PDF generation.',
                }
          )
        )
      }
    )

    const polling = Effect.fn('CvPublicationProgress.polling')(function* (
      runId: string,
      link: CvLink,
      job: PdfJobResponse
    ) {
      yield* SubscriptionRef.update(runs, (current) =>
        updateRun(current, runId, (run) =>
          run._tag !== 'StartingPdf' && run._tag !== 'PollingPdf'
            ? run
            : {
                ...common(run),
                _tag: 'PollingPdf',
                link,
                message: `PDF generation is ${job.status}.`,
                job,
              }
        )
      )
    })

    const verifying = Effect.fn('CvPublicationProgress.verifying')(function* (
      runId: string,
      link: CvLink,
      job: PdfJobResponse
    ) {
      yield* SubscriptionRef.update(runs, (current) =>
        updateRun(current, runId, (run) =>
          run._tag !== 'PollingPdf' && run._tag !== 'StartingPdf'
            ? run
            : {
                ...common(run),
                _tag: 'VerifyingArtifact',
                link,
                message: 'Verifying the current published PDF artifact.',
                job,
              }
        )
      )
    })

    const complete = Effect.fn('CvPublicationProgress.complete')(function* (
      result: CvPublicationWorkflowResult
    ) {
      yield* SubscriptionRef.update(runs, (current) =>
        updateRun(current, result.runId, (run) =>
          run._tag !== 'VerifyingArtifact'
            ? run
            : {
                ...common(run),
                _tag: 'Published',
                message: 'The approved CV and verified PDF are published.',
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
        updateRun(current, runId, (run) => {
          if (
            run._tag === 'Published' ||
            run._tag === 'Failed' ||
            run._tag === 'Cancelled'
          ) {
            return run
          }
          if (run._tag === 'Cancelling') {
            return {
              ...common(run),
              _tag: 'Cancelled',
              message: 'CV publication cancelled for this browser session.',
            }
          }
          return {
            ...common(run),
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
            !isActive(run)
          ) {
            return [null, current] as const
          }
          const next = new Map(current)
          next.set(runId, {
            ...common(run),
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
        updateRun(current, runId, (run) =>
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
        updateRun(current, runId, (run) =>
          !isActive(run) && run._tag !== 'Cancelling'
            ? run
            : {
                ...common(run),
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
      polling,
      publishing,
      releaseReservation,
      requestCancel,
      reserve,
      restoreCancellation,
      runs,
      startingPdf,
      verifying,
    })
  })
)
