import type { Effect } from 'effect'
import type { PrepareCampaignTarget } from '../../config/model'
import type { WorkflowOutput, WorkflowOutputs } from './key'

export const workflowFailurePolicies = [
  'fail-run',
  'fail-target',
  'warn',
] as const

export type WorkflowFailurePolicy = (typeof workflowFailurePolicies)[number]
export type WorkflowScope = 'run' | 'target'

export type WorkflowStepContext = {
  readonly issues: readonly WorkflowExecutionIssue[]
  readonly outputs: WorkflowOutputs
  readonly target?: PrepareCampaignTarget
}

export type WorkflowStep<R = never> = {
  readonly dependsOn?: readonly string[]
  readonly execute: (
    context: WorkflowStepContext
  ) => Effect.Effect<readonly WorkflowOutput<unknown>[], unknown, R>
  readonly failurePolicy: WorkflowFailurePolicy
  readonly id: string
  readonly label: string
  readonly owner?: string
  readonly scope: WorkflowScope
}

export type CompiledWorkflowGraph<R> = {
  readonly layers: readonly (readonly WorkflowStep<R>[])[]
  readonly steps: readonly WorkflowStep<R>[]
}

export type WorkflowExecutionIssue = {
  readonly cause: unknown
  readonly message: string
  readonly owner?: string
  readonly stepId: string
}

export type WorkflowExecutionSuccess = {
  readonly issues: readonly WorkflowExecutionIssue[]
  readonly outputs: WorkflowOutputs
  readonly status: 'succeeded'
}

export type WorkflowExecutionTargetFailure = {
  readonly cause: unknown
  readonly failedStepId: string
  readonly issues: readonly WorkflowExecutionIssue[]
  readonly outputs: WorkflowOutputs
  readonly status: 'failed'
}

export type WorkflowExecutionResult =
  | WorkflowExecutionSuccess
  | WorkflowExecutionTargetFailure

export type CampaignPlugin = {
  readonly id: string
  readonly steps: readonly WorkflowStep<never>[]
  readonly version?: string
}
