import { Cause, Data, Effect, Exit } from 'effect'
import { CampaignProgressEvent, reportCampaignProgress } from '../progress'
import type { WorkflowOutputs } from './key'
import type {
  CompiledWorkflowGraph,
  WorkflowExecutionIssue,
  WorkflowExecutionResult,
  WorkflowStep,
} from './types'

export class WorkflowRunFailedError extends Data.TaggedError(
  'WorkflowRunFailedError'
)<{
  readonly cause: unknown
  readonly message: string
  readonly stepId: string
}> {}

const failureCause = (cause: Cause.Cause<unknown>) => Cause.squash(cause)

const executeStep = <R>(
  step: WorkflowStep<R>,
  outputs: WorkflowOutputs,
  issues: readonly WorkflowExecutionIssue[],
  target: Parameters<WorkflowStep<R>['execute']>[0]['target']
) =>
  reportCampaignProgress(
    CampaignProgressEvent.StepStarted({ stepId: step.id })
  ).pipe(
    Effect.andThen(step.execute({ issues, outputs, target })),
    Effect.exit,
    Effect.tap((exit) =>
      Exit.match(exit, {
        onFailure: (cause) =>
          reportCampaignProgress(
            CampaignProgressEvent.StepFailed({
              message: String(failureCause(cause)),
              stepId: step.id,
            })
          ),
        onSuccess: () =>
          reportCampaignProgress(
            CampaignProgressEvent.StepSucceeded({ stepId: step.id })
          ),
      })
    ),
    Effect.map((exit) => ({ exit, step }))
  )

export const executeWorkflowGraph = <R>({
  graph,
  initialOutputs,
  target,
}: {
  readonly graph: CompiledWorkflowGraph<R>
  readonly initialOutputs: WorkflowOutputs
  readonly target?: Parameters<WorkflowStep<R>['execute']>[0]['target']
}): Effect.Effect<WorkflowExecutionResult, WorkflowRunFailedError, R> =>
  Effect.gen(function* () {
    let outputs = initialOutputs
    const issues: WorkflowExecutionIssue[] = []

    for (const layer of graph.layers) {
      const results = yield* Effect.forEach(
        layer,
        (step) => executeStep(step, outputs, issues, target),
        { concurrency: 'unbounded' }
      )

      for (const { exit, step } of results) {
        if (Exit.isSuccess(exit)) {
          outputs = yield* outputs.addAll(exit.value).pipe(
            Effect.mapError(
              (cause) =>
                new WorkflowRunFailedError({
                  cause,
                  message: cause.message,
                  stepId: step.id,
                })
            )
          )
          continue
        }

        const cause = failureCause(exit.cause)
        if (step.failurePolicy === 'fail-run') {
          return yield* new WorkflowRunFailedError({
            cause,
            message: `Workflow step "${step.id}" failed: ${String(cause)}`,
            stepId: step.id,
          })
        }

        if (step.failurePolicy === 'fail-target') {
          return {
            cause,
            failedStepId: step.id,
            issues,
            outputs,
            status: 'failed',
          }
        }

        issues.push({
          cause,
          message: `Optional workflow step "${step.id}" failed: ${String(cause)}`,
          owner: step.owner,
          stepId: step.id,
        })
      }
    }

    return { issues, outputs, status: 'succeeded' }
  })
