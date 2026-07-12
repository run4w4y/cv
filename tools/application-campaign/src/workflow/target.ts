import { Effect } from 'effect'
import { ApplicationAdvisor } from '../ai/advisor'
import { CampaignPlugins } from '../plugins/service'
import type { ApplicationCampaignRuntime } from '../runtime'
import { logInfo, urlHost, withTelemetrySpan } from '../telemetry'
import {
  compileWorkflowGraph,
  executeWorkflowGraph,
  instantiateTargetWorkflowStep,
  type WorkflowStep,
  workflowOutput,
} from './graph'
import { uniqueIssues } from './issues'
import { campaignStructuredAiKey, targetPreparedCampaignKey } from './keys'
import {
  CampaignProgressEvent,
  reportCampaignProgress,
  reportStepSkipped,
} from './progress'
import { coreTargetSteps } from './target/core-steps'
import type { PrepareCampaignTargetInput } from './target/model'
import { failedCampaign, targetWorkflowIssue } from './target/results'
import type { PreparedCampaignResult } from './types'

export type { PrepareCampaignTargetInput } from './target/model'

export const prepareCampaignTarget = (input: PrepareCampaignTargetInput) =>
  Effect.gen(function* () {
    const { options, runId, targetRoutine } = input
    const { target } = targetRoutine
    const advisor = yield* ApplicationAdvisor
    const plugins = yield* CampaignPlugins

    yield* logInfo('Preparing application campaign target', {
      generate: options.generate,
      jobHost: urlHost(target.url),
      locale: options.locale,
      materials: options.materials,
      outDir: target.outDir,
    })
    yield* Effect.forEach(
      targetRoutine.steps,
      (step) =>
        step.status === 'skipped'
          ? reportStepSkipped(step, step.reason)
          : Effect.void,
      { discard: true }
    )

    const runStepIds = new Set(plugins.runSteps.map((step) => step.id))
    const pluginSteps = plugins.targetSteps.map((step) =>
      instantiateTargetWorkflowStep(step, target, runStepIds)
    )
    const steps: readonly WorkflowStep<ApplicationCampaignRuntime>[] = [
      ...coreTargetSteps({ ...input, advisor, plugins }),
      ...pluginSteps,
    ]
    const graph = yield* compileWorkflowGraph(steps, {
      externalDependencies: [...runStepIds],
    })
    const initialOutputs = yield* input.baseOutputs.addAll([
      workflowOutput(campaignStructuredAiKey, advisor.structured),
    ])
    const result = yield* executeWorkflowGraph({
      graph,
      initialOutputs,
      target,
    })

    if (result.status === 'failed') {
      yield* reportCampaignProgress(
        CampaignProgressEvent.TargetFailed({
          reason: `Skipped after ${result.failedStepId} failed.`,
          targetIndex: target.index,
        })
      )
      return failedCampaign({
        cause: result.cause,
        failedStepId: result.failedStepId,
        issues: result.issues,
        outputs: result.outputs,
        runId,
        targetRoutine,
      })
    }

    const campaign = yield* result.outputs.get(targetPreparedCampaignKey)
    const postCommitIssues = result.issues.map((issue) =>
      targetWorkflowIssue(issue, targetRoutine)
    )

    return postCommitIssues.length === 0
      ? campaign
      : ({
          ...campaign,
          issues: uniqueIssues([...campaign.issues, ...postCommitIssues]),
          status: 'partial',
        } satisfies PreparedCampaignResult)
  }).pipe(
    withTelemetrySpan('application-campaign.prepare-target', {
      jobHost: urlHost(input.targetRoutine.target.url),
      targetIndex: input.targetRoutine.target.index,
    })
  )
