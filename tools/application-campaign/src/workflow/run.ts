import { Crypto, Effect } from 'effect'
import { uniq } from 'es-toolkit'
import type { PrepareCampaignOptions } from '../config/model'
import { CampaignPlugins } from '../plugins/service'
import { logInfo, withTelemetrySpan } from '../telemetry'
import {
  compileWorkflowGraph,
  executeWorkflowGraph,
  WorkflowOutputs,
  type WorkflowStep,
  workflowOutput,
} from './graph'
import { uniqueIssues } from './issues'
import {
  campaignOptionsKey,
  campaignRunIdKey,
  preparedCampaignRunKey,
} from './keys'
import { CampaignProgressEvent, reportCampaignProgress } from './progress'
import { resolveCampaignRoutine } from './routine'
import {
  type CampaignWorkflowRuntime,
  makeCoreRunSteps,
  runIssue,
} from './run/steps'

export { campaignRunStatus } from './run/status'

export type { PreparedCampaignResult, PreparedCampaignRun } from './types'

export const prepareCampaign = (options: PrepareCampaignOptions) =>
  Effect.gen(function* () {
    const crypto = yield* Crypto.Crypto
    const runId = yield* crypto.randomUUIDv7
    const plugins = yield* CampaignPlugins

    yield* reportCampaignProgress(
      CampaignProgressEvent.RunStarted({
        concurrency: options.concurrency,
        targetCount: options.targets.length,
      })
    )
    yield* logInfo('Preparing application campaign run', {
      concurrency: options.concurrency,
      excludedProfileCount: options.excludedProfiles?.length,
      generate: options.generate,
      locale: options.locale,
      materials: options.materials,
      targetCount: options.targets.length,
    })

    const routine = yield* resolveCampaignRoutine(options)
    yield* reportCampaignProgress(
      CampaignProgressEvent.RoutineResolved({ routine })
    )
    const coreSteps = makeCoreRunSteps({
      options,
      targetRunDependencies: uniq(
        plugins.targetSteps.flatMap((step) =>
          (step.dependsOn ?? []).filter((dependency) =>
            plugins.runSteps.some((runStep) => runStep.id === dependency)
          )
        )
      ),
      routine,
      runId,
    })
    const steps: readonly WorkflowStep<CampaignWorkflowRuntime>[] = [
      ...plugins.runSteps,
      ...coreSteps,
    ]
    const graph = yield* compileWorkflowGraph(steps)
    const initialOutputs = yield* WorkflowOutputs.from([
      workflowOutput(campaignOptionsKey, options),
      workflowOutput(campaignRunIdKey, runId),
    ])
    const execution = yield* executeWorkflowGraph({
      graph,
      initialOutputs,
    })

    if (execution.status === 'failed') {
      return yield* Effect.die(
        new Error(
          `Run-scoped step ${execution.failedStepId} used the invalid fail-target policy.`
        )
      )
    }

    const written = yield* execution.outputs.get(preparedCampaignRunKey)
    const postArtifactIssues = execution.issues.map(runIssue)
    const result =
      postArtifactIssues.length === 0
        ? written
        : {
            ...written,
            issues: uniqueIssues([...written.issues, ...postArtifactIssues]),
          }

    yield* logInfo('Finished application campaign run', {
      failedCampaignCount: result.campaigns.filter(
        (campaign) => campaign.status === 'failed'
      ).length,
      partialCampaignCount: result.campaigns.filter(
        (campaign) => campaign.status === 'partial'
      ).length,
      status: result.status,
      succeededCampaignCount: result.campaigns.filter(
        (campaign) => campaign.status === 'succeeded'
      ).length,
      targetCount: result.campaigns.length,
    })
    yield* reportCampaignProgress(
      CampaignProgressEvent.RunFinished({
        errorCount: result.issues.filter((issue) => issue.severity === 'error')
          .length,
        status: result.status,
        warningCount: result.issues.filter(
          (issue) => issue.severity === 'warning'
        ).length,
      })
    )

    return result
  }).pipe(
    withTelemetrySpan('application-campaign.prepare', {
      generate: options.generate,
      locale: options.locale,
      targetCount: options.targets.length,
    })
  )
