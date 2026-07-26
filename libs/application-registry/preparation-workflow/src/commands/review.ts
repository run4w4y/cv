import { Effect, Exit, SubscriptionRef } from 'effect'
import * as DurableDeferred from 'effect/unstable/workflow/DurableDeferred'
import * as WorkflowEngine from 'effect/unstable/workflow/WorkflowEngine'

import {
  type ApproveArtifactInput,
  type ArtifactApproval,
  type DocumentKind,
  PreparationWorkflowError,
  PrepareApplicationWorkflow,
  preparationApprovalDeferred,
} from '../domain'
import { PreparationGateway } from '../gateway'
import { PreparationProgress } from '../progress'
import { artifactForKind } from '../progress/state'

export type ApproveArtifactWithTokenInput = {
  readonly jobId: string
  readonly kind: DocumentKind
  readonly revisionId: string
  readonly token: DurableDeferred.Token
}

const reviewNoLongerAwaiting = () =>
  new PreparationWorkflowError({
    message: 'This artifact review is no longer awaiting a decision.',
    stage: 'review',
  })

export const makeApproveArtifact = <E, R>(
  complete: (input: ApproveArtifactWithTokenInput) => Effect.Effect<void, E, R>
) =>
  Effect.fn('PreparationWorkflow.approveArtifact')(function* (
    input: ApproveArtifactWithTokenInput
  ) {
    const { jobId, kind, token } = input
    const progress = yield* PreparationProgress
    yield* Effect.uninterruptible(
      Effect.gen(function* () {
        const claimed = yield* progress.approvalSubmitted(jobId, kind, token)
        if (!claimed) {
          return yield* Effect.fail(reviewNoLongerAwaiting())
        }
        const completion = yield* Effect.exit(complete(input))
        if (Exit.isFailure(completion)) {
          yield* progress.restoreApproval(jobId, kind, token)
        }
        return yield* completion
      })
    )
  })

export const makePreflightedApproveArtifact = <
  E,
  R,
  PreflightError,
  PreflightRequirements,
>(
  preflight: (
    input: ApproveArtifactWithTokenInput
  ) => Effect.Effect<void, PreflightError, PreflightRequirements>,
  complete: (input: ApproveArtifactWithTokenInput) => Effect.Effect<void, E, R>
) => {
  const submit = makeApproveArtifact(complete)
  return Effect.fn('PreparationWorkflow.approveArtifactWithPreflight')(
    function* (input: ApproveArtifactWithTokenInput) {
      yield* preflight(input)
      return yield* submit(input)
    }
  )
}

/** Checks fresh registry ancestry before the review token is claimed. */
export const preflightArtifactApproval = Effect.fn(
  'PreparationWorkflow.preflightArtifactApproval'
)(function* (input: ApproveArtifactWithTokenInput) {
  const progress = yield* PreparationProgress
  const jobs = yield* SubscriptionRef.get(progress.jobs)
  const job = jobs.get(input.jobId)
  const artifact = job === undefined ? null : artifactForKind(job, input.kind)
  if (
    artifact === null ||
    artifact.status !== 'awaiting_review' ||
    artifact.reviewToken !== input.token ||
    artifact.candidate === null
  ) {
    return yield* Effect.fail(reviewNoLongerAwaiting())
  }

  const gateway = yield* PreparationGateway
  yield* gateway.verifyBoundRevision(artifact.candidate, input.revisionId)
})

export const approveArtifactWithToken = makePreflightedApproveArtifact(
  preflightArtifactApproval,
  ({ revisionId, jobId, kind, token }) =>
    DurableDeferred.succeed(preparationApprovalDeferred(kind), {
      token,
      value: {
        revisionId,
      } satisfies ArtifactApproval,
    }).pipe(Effect.annotateLogs({ artifact: kind, jobId }))
)

export type CancelAiWorkflowJobExecutionInput = {
  readonly executionId: string
  readonly jobId: string
}

export const interruptPreparationExecution = (
  engine: WorkflowEngine.WorkflowEngine['Service'],
  mode: 'active' | 'suspended',
  executionId: string
): Effect.Effect<void> =>
  mode === 'suspended'
    ? engine.interrupt(PrepareApplicationWorkflow, executionId)
    : engine.interruptUnsafe(PrepareApplicationWorkflow, executionId)

export const cancelAiWorkflowJobExecution = Effect.fn(
  'PreparationWorkflow.cancelJobExecution'
)(function* ({ executionId, jobId }: CancelAiWorkflowJobExecutionInput) {
  const engine = yield* WorkflowEngine.WorkflowEngine
  const progress = yield* PreparationProgress
  yield* Effect.uninterruptibleMask((restore) =>
    Effect.gen(function* () {
      const claimed = yield* progress.requestCancel(jobId, executionId)
      if (claimed === null) return
      const interruption = yield* Effect.exit(
        restore(
          interruptPreparationExecution(engine, claimed.mode, executionId)
        )
      )
      if (Exit.isFailure(interruption)) {
        yield* progress.restoreCancellation(jobId, executionId, claimed)
        return yield* interruption
      }
      yield* progress.cancelJob(jobId)
    })
  )
})

export const approveArtifact = Effect.fn(
  'PreparationWorkflow.approveArtifactForJob'
)(function* (input: ApproveArtifactInput) {
  const progress = yield* PreparationProgress
  const jobs = yield* SubscriptionRef.get(progress.jobs)
  const job = jobs.get(input.jobId)
  const artifact =
    job === undefined ? null : artifactForKind(job, input.artifact)
  if (
    artifact === null ||
    artifact.status !== 'awaiting_review' ||
    artifact.reviewToken === null
  ) {
    return yield* Effect.fail(reviewNoLongerAwaiting())
  }
  return yield* approveArtifactWithToken({
    jobId: input.jobId,
    kind: input.artifact,
    revisionId: input.revisionId,
    token: artifact.reviewToken,
  })
})

export const cancelAiWorkflowJob = Effect.fn('PreparationWorkflow.cancelJob')(
  function* (jobId: string) {
    const progress = yield* PreparationProgress
    const jobs = yield* SubscriptionRef.get(progress.jobs)
    const job = jobs.get(jobId)
    if (job?.executionId === null || job?.executionId === undefined) return
    return yield* cancelAiWorkflowJobExecution({
      executionId: job.executionId,
      jobId,
    })
  }
)
