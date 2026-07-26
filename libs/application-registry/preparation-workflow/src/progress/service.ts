import { Clock, Effect, Layer, SubscriptionRef } from 'effect'
import type * as DurableDeferred from 'effect/unstable/workflow/DurableDeferred'

import type {
  ArtifactPreparationStage,
  ContentRevisionResult,
  DocumentKind,
  PreparationArtifactState,
  PreparationJobState,
  SavedCandidate,
  SharedPreparationStage,
} from '../domain'
import { PreparationWorkflowError } from '../domain'
import type {
  CancellationClaim,
  PreparationJobReservation,
  PreparationJobStates,
} from './model'
import { PreparationProgress } from './model'
import {
  releasePreparationReservations,
  reservePreparationJobs,
} from './reservations'
import {
  advancePreparationStep,
  artifactForKind,
  cancelArtifact,
  completeArtifactHistory,
  completeCurrentStep,
  finishPreparationStep,
  updateJobArtifact,
  updatePreparationJob,
  withDerivedJobStatus,
} from './state'

const artifactIsTerminal = (artifact: PreparationArtifactState): boolean =>
  artifact.status === 'approved' ||
  artifact.status === 'failed' ||
  artifact.status === 'blocked' ||
  artifact.status === 'cancelled'

const failArtifactState = (
  artifact: PreparationArtifactState,
  message: string,
  updatedAt: number
): PreparationArtifactState => {
  if (artifactIsTerminal(artifact)) return artifact
  const stage =
    artifact.stage ?? (artifact.kind === 'cv' ? 'planning' : 'composition')
  return {
    ...artifact,
    error: message,
    history: finishPreparationStep(
      artifact.history,
      stage,
      message,
      updatedAt,
      'failed'
    ),
    message,
    reviewToken: null,
    stage,
    status: 'failed',
    updatedAt,
  }
}

const blockArtifactState = (
  artifact: PreparationArtifactState,
  message: string,
  updatedAt: number
): PreparationArtifactState => {
  if (artifactIsTerminal(artifact)) return artifact
  const stage =
    artifact.stage ?? (artifact.kind === 'cv' ? 'planning' : 'composition')
  return {
    ...artifact,
    error: null,
    history: finishPreparationStep(
      artifact.history,
      stage,
      message,
      updatedAt,
      'blocked'
    ),
    message,
    reviewToken: null,
    stage,
    status: 'blocked',
    updatedAt,
  }
}

const activeJob = (job: PreparationJobState): boolean =>
  job.executionId !== null &&
  (job.status === 'queued' ||
    job.status === 'running' ||
    job.status === 'needs_review')

export const preparationProgressLayer = Layer.effect(
  PreparationProgress,
  Effect.gen(function* () {
    const jobs = yield* SubscriptionRef.make<PreparationJobStates>(new Map())

    const reserve = Effect.fn('PreparationProgress.reserve')(function* (
      reservations: ReadonlyArray<PreparationJobReservation>
    ) {
      const createdAt = yield* Clock.currentTimeMillis
      const conflictMessage = yield* SubscriptionRef.modify(jobs, (current) => {
        const reserved = reservePreparationJobs(
          current,
          reservations,
          createdAt
        )
        return [reserved.conflict, reserved.jobs] as const
      })
      if (conflictMessage === null) return
      return yield* Effect.fail(
        new PreparationWorkflowError({
          message: conflictMessage,
          stage: 'queued',
        })
      )
    })

    const releaseReservations = Effect.fn(
      'PreparationProgress.releaseReservations'
    )(function* (jobIds: ReadonlyArray<string>) {
      yield* SubscriptionRef.update(jobs, (current) =>
        releasePreparationReservations(current, jobIds)
      )
    })

    const setExecution = Effect.fn('PreparationProgress.setExecution')(
      function* (jobId: string, executionId: string) {
        const updatedAt = yield* Clock.currentTimeMillis
        yield* SubscriptionRef.update(jobs, (current) =>
          updatePreparationJob(current, jobId, (job) => ({
            ...job,
            executionId,
            updatedAt,
          }))
        )
      }
    )

    const identify = Effect.fn('PreparationProgress.identify')(function* (
      jobId: string,
      identity: {
        readonly applicationId: string
        readonly company: string | null
        readonly role: string
      }
    ) {
      const updatedAt = yield* Clock.currentTimeMillis
      yield* SubscriptionRef.update(jobs, (current) =>
        updatePreparationJob(current, jobId, (job) => ({
          ...job,
          ...identity,
          updatedAt,
        }))
      )
    })

    const stageShared = Effect.fn('PreparationProgress.stageShared')(function* (
      jobId: string,
      nextStage: SharedPreparationStage,
      message: string,
      applicationId?: string
    ) {
      const updatedAt = yield* Clock.currentTimeMillis
      yield* SubscriptionRef.update(jobs, (current) =>
        updatePreparationJob(current, jobId, (job) => {
          if (!activeJob(job) || job.shared.status !== 'running') return job
          return {
            ...job,
            ...(applicationId === undefined ? {} : { applicationId }),
            error: null,
            message,
            shared: {
              history: advancePreparationStep(
                job.shared.history,
                nextStage,
                message,
                updatedAt
              ),
              stage: nextStage,
              status: 'running',
            },
            status: nextStage === 'queued' ? 'queued' : 'running',
            updatedAt,
          }
        })
      )
    })

    const stageArtifact = Effect.fn('PreparationProgress.stageArtifact')(
      function* (
        jobId: string,
        kind: DocumentKind,
        nextStage: ArtifactPreparationStage,
        message: string
      ) {
        const updatedAt = yield* Clock.currentTimeMillis
        yield* SubscriptionRef.update(jobs, (current) =>
          updatePreparationJob(current, jobId, (job) => {
            if (!activeJob(job)) return job
            const artifact = artifactForKind(job, kind)
            if (
              artifact === null ||
              (artifact.status !== 'queued' && artifact.status !== 'running')
            ) {
              return job
            }
            const updated = updateJobArtifact(job, kind, (currentArtifact) => ({
              ...currentArtifact,
              candidate: null,
              error: null,
              history: advancePreparationStep(
                currentArtifact.history,
                nextStage,
                message,
                updatedAt
              ),
              message,
              reviewToken: null,
              stage: nextStage,
              status: 'running',
              updatedAt,
            }))
            return withDerivedJobStatus({
              ...updated,
              error: null,
              message,
              shared:
                updated.shared.status === 'running'
                  ? {
                      ...updated.shared,
                      history: completeCurrentStep(
                        updated.shared.history,
                        updatedAt
                      ),
                      status: 'completed',
                    }
                  : updated.shared,
              updatedAt,
            })
          })
        )
      }
    )

    const reviewReady = Effect.fn('PreparationProgress.reviewReady')(function* (
      jobId: string,
      kind: DocumentKind,
      applicationId: string,
      candidate: SavedCandidate,
      reviewToken: DurableDeferred.Token
    ) {
      const updatedAt = yield* Clock.currentTimeMillis
      const message = 'Candidate saved. Human review is required.'
      yield* SubscriptionRef.update(jobs, (current) =>
        updatePreparationJob(current, jobId, (job) => {
          if (!activeJob(job)) return job
          const updated = updateJobArtifact(job, kind, (artifact) => {
            if (artifact.status !== 'queued' && artifact.status !== 'running') {
              return artifact
            }
            return {
              ...artifact,
              candidate,
              error: null,
              history: advancePreparationStep(
                artifact.history,
                'review',
                message,
                updatedAt,
                'waiting'
              ),
              message,
              reviewToken,
              stage: 'review',
              status: 'awaiting_review',
              updatedAt,
            }
          })
          return withDerivedJobStatus({
            ...updated,
            applicationId,
            message,
            updatedAt,
          })
        })
      )
    })

    const approveArtifact = Effect.fn('PreparationProgress.approveArtifact')(
      function* (
        jobId: string,
        kind: DocumentKind,
        completion: {
          readonly message: string
          readonly result: ContentRevisionResult
        }
      ) {
        const updatedAt = yield* Clock.currentTimeMillis
        yield* SubscriptionRef.update(jobs, (current) =>
          updatePreparationJob(current, jobId, (job) => {
            const updated = updateJobArtifact(job, kind, (artifact) => {
              if (
                (artifact.status !== 'awaiting_review' &&
                  artifact.status !== 'review_submitted') ||
                artifact.candidate === null
              ) {
                return artifact
              }
              return {
                ...artifact,
                candidate: {
                  ...artifact.candidate,
                  result: completion.result,
                },
                history: completeArtifactHistory(
                  artifact.history,
                  completion.message,
                  updatedAt
                ),
                message: completion.message,
                reviewToken: null,
                stage: 'complete',
                status: 'approved',
                updatedAt,
              }
            })
            return withDerivedJobStatus({
              ...updated,
              message: completion.message,
              updatedAt,
            })
          })
        )
      }
    )

    const approvalSubmitted = Effect.fn(
      'PreparationProgress.approvalSubmitted'
    )(function* (
      jobId: string,
      kind: DocumentKind,
      token: DurableDeferred.Token
    ) {
      const updatedAt = yield* Clock.currentTimeMillis
      const message = 'Human approval submitted.'
      return yield* SubscriptionRef.modify(jobs, (current) => {
        const job = current.get(jobId)
        const artifact = job === undefined ? null : artifactForKind(job, kind)
        if (
          job === undefined ||
          artifact === null ||
          artifact.status !== 'awaiting_review' ||
          artifact.reviewToken !== token
        ) {
          return [false, current] as const
        }
        const updated = updateJobArtifact(job, kind, (currentArtifact) => ({
          ...currentArtifact,
          history: advancePreparationStep(
            currentArtifact.history,
            'review',
            message,
            updatedAt
          ),
          message,
          reviewToken: null,
          status: 'review_submitted',
          updatedAt,
        }))
        const next = new Map(current)
        next.set(
          jobId,
          withDerivedJobStatus({ ...updated, message, updatedAt })
        )
        return [true, next] as const
      })
    })

    const restoreApproval = Effect.fn('PreparationProgress.restoreApproval')(
      function* (
        jobId: string,
        kind: DocumentKind,
        reviewToken: DurableDeferred.Token
      ) {
        const updatedAt = yield* Clock.currentTimeMillis
        const message = 'Candidate saved. Human review is required.'
        yield* SubscriptionRef.update(jobs, (current) =>
          updatePreparationJob(current, jobId, (job) => {
            const updated = updateJobArtifact(job, kind, (artifact) =>
              artifact.status !== 'review_submitted'
                ? artifact
                : {
                    ...artifact,
                    history: advancePreparationStep(
                      artifact.history,
                      'review',
                      message,
                      updatedAt,
                      'waiting'
                    ),
                    message,
                    reviewToken,
                    status: 'awaiting_review',
                    updatedAt,
                  }
            )
            return withDerivedJobStatus({
              ...updated,
              message,
              updatedAt,
            })
          })
        )
      }
    )

    const failArtifact = Effect.fn('PreparationProgress.failArtifact')(
      function* (jobId: string, kind: DocumentKind, message: string) {
        const updatedAt = yield* Clock.currentTimeMillis
        yield* SubscriptionRef.update(jobs, (current) =>
          updatePreparationJob(current, jobId, (job) => {
            const updated = updateJobArtifact(job, kind, (artifact) =>
              failArtifactState(artifact, message, updatedAt)
            )
            return withDerivedJobStatus({
              ...updated,
              message,
              updatedAt,
            })
          })
        )
      }
    )

    const blockArtifact = Effect.fn('PreparationProgress.blockArtifact')(
      function* (jobId: string, kind: DocumentKind, message: string) {
        const updatedAt = yield* Clock.currentTimeMillis
        yield* SubscriptionRef.update(jobs, (current) =>
          updatePreparationJob(current, jobId, (job) => {
            const updated = updateJobArtifact(job, kind, (artifact) =>
              blockArtifactState(artifact, message, updatedAt)
            )
            return withDerivedJobStatus({
              ...updated,
              message,
              updatedAt,
            })
          })
        )
      }
    )

    const failJob = Effect.fn('PreparationProgress.failJob')(function* (
      jobId: string,
      message: string
    ) {
      const updatedAt = yield* Clock.currentTimeMillis
      yield* SubscriptionRef.update(jobs, (current) =>
        updatePreparationJob(current, jobId, (job) => {
          if (
            job.status === 'completed' ||
            job.status === 'failed' ||
            job.status === 'cancelled' ||
            job.status === 'mixed'
          ) {
            return job
          }
          const fail = (artifact: PreparationArtifactState | null) =>
            artifact === null
              ? null
              : failArtifactState(artifact, message, updatedAt)
          return {
            ...job,
            artifacts: {
              coverLetter: fail(job.artifacts.coverLetter),
              cv: fail(job.artifacts.cv),
            },
            error: message,
            message,
            shared:
              job.shared.status === 'running'
                ? {
                    ...job.shared,
                    history: finishPreparationStep(
                      job.shared.history,
                      job.shared.stage,
                      message,
                      updatedAt,
                      'failed'
                    ),
                    status: 'failed',
                  }
                : job.shared,
            status: 'failed',
            updatedAt,
          }
        })
      )
    })

    const cancelJob = Effect.fn('PreparationProgress.cancelJob')(function* (
      jobId: string
    ) {
      const updatedAt = yield* Clock.currentTimeMillis
      const message = 'AI workflow cancelled for this browser session.'
      yield* SubscriptionRef.update(jobs, (current) =>
        updatePreparationJob(current, jobId, (job) => {
          if (
            job.status === 'completed' ||
            job.status === 'failed' ||
            job.status === 'cancelled' ||
            job.status === 'mixed'
          ) {
            return job
          }
          const cancel = (artifact: PreparationArtifactState | null) =>
            artifact === null
              ? null
              : cancelArtifact(artifact, message, updatedAt)
          return {
            ...job,
            artifacts: {
              coverLetter: cancel(job.artifacts.coverLetter),
              cv: cancel(job.artifacts.cv),
            },
            error: null,
            message,
            shared:
              job.shared.status === 'running'
                ? {
                    ...job.shared,
                    history: finishPreparationStep(
                      job.shared.history,
                      job.shared.stage,
                      message,
                      updatedAt,
                      'cancelled'
                    ),
                    status: 'cancelled',
                  }
                : job.shared,
            status: 'cancelled',
            updatedAt,
          }
        })
      )
    })

    const requestCancel = Effect.fn('PreparationProgress.requestCancel')(
      function* (jobId: string, executionId: string) {
        const updatedAt = yield* Clock.currentTimeMillis
        return yield* SubscriptionRef.modify(jobs, (current) => {
          const job = current.get(jobId)
          if (
            job === undefined ||
            job.executionId !== executionId ||
            (job.status !== 'queued' &&
              job.status !== 'running' &&
              job.status !== 'needs_review')
          ) {
            return [null, current] as const
          }
          const artifacts = [
            job.artifacts.cv,
            job.artifacts.coverLetter,
          ].filter(
            (artifact): artifact is PreparationArtifactState =>
              artifact !== null
          )
          const suspended =
            artifacts.some(
              (artifact) =>
                artifact.status === 'awaiting_review' ||
                artifact.status === 'review_submitted'
            ) &&
            artifacts.every(
              (artifact) =>
                artifactIsTerminal(artifact) ||
                artifact.status === 'awaiting_review' ||
                artifact.status === 'review_submitted'
            )
          const next = new Map(current)
          next.set(jobId, {
            ...job,
            error: null,
            message: 'Cancelling AI workflow for this browser session.',
            status: 'cancelling',
            updatedAt,
          })
          return [
            {
              mode: suspended ? ('suspended' as const) : ('active' as const),
              previous: job,
            },
            next,
          ] as const
        })
      }
    )

    const restoreCancellation = Effect.fn(
      'PreparationProgress.restoreCancellation'
    )(function* (jobId: string, executionId: string, claim: CancellationClaim) {
      const updatedAt = yield* Clock.currentTimeMillis
      yield* SubscriptionRef.update(jobs, (current) =>
        updatePreparationJob(current, jobId, (job) =>
          job.status === 'cancelling' && job.executionId === executionId
            ? { ...claim.previous, updatedAt }
            : job
        )
      )
    })

    return PreparationProgress.of({
      approvalSubmitted,
      approveArtifact,
      blockArtifact,
      cancelJob,
      failArtifact,
      failJob,
      identify,
      jobs,
      releaseReservations,
      requestCancel,
      reserve,
      restoreCancellation,
      restoreApproval,
      reviewReady,
      setExecution,
      stageArtifact,
      stageShared,
    })
  })
)
