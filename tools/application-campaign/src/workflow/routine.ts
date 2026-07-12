import { Effect } from 'effect'
import { uniq } from 'es-toolkit'
import type { PrepareCampaignOptions } from '../config/model'
import { CampaignPlugins } from '../plugins/service'
import { logInfo, logWarning, urlHost, withTelemetrySpan } from '../telemetry'
import { readyRoutineStep } from './routine/builders'
import { resolveTargetRoutine } from './routine/target'
import type { CampaignRoutine, RoutineStep } from './routine/types'
import { campaignWorkflowStepIds } from './step-ids'

export type {
  CampaignIssue,
  CampaignRoutine,
  CampaignTargetRoutine,
  ReadyRoutineStep,
  RoutineStep,
  SkippedRoutineStep,
} from './routine/types'

export const resolveCampaignRoutine = (options: PrepareCampaignOptions) =>
  Effect.gen(function* () {
    const plugins = yield* CampaignPlugins
    const profiles = readyRoutineStep({
      config: undefined,
      id: campaignWorkflowStepIds.profiles,
      label: 'Discover and render CV profiles',
    })
    const runStepIds = new Set(plugins.runSteps.map((step) => step.id))
    const targetRunDependencies = uniq(
      plugins.targetSteps.flatMap((step) =>
        (step.dependsOn ?? []).filter((dependency) =>
          runStepIds.has(dependency)
        )
      )
    )
    const analysisStepDependencies = uniq(
      plugins.analysisContributions.map((contribution) => contribution.stepId)
    )
    const targets = options.targets.map((target) =>
      resolveTargetRoutine({
        analysisStepDependencies,
        options,
        pluginSteps: plugins.targetSteps,
        runStepIds,
        target,
      })
    )
    const targetsStep = readyRoutineStep({
      config: undefined,
      dependsOn: [profiles.id, ...targetRunDependencies],
      id: campaignWorkflowStepIds.targets,
      label: 'Prepare campaign targets',
    })
    const runArtifacts = readyRoutineStep({
      config: undefined,
      dependsOn: [targetsStep.id],
      id: campaignWorkflowStepIds.runArtifacts,
      label: 'Write campaign run manifest',
    })
    const pluginSteps = plugins.runSteps.map((step) =>
      readyRoutineStep({
        config: undefined,
        dependsOn: step.dependsOn,
        id: step.id,
        label: step.label,
      })
    )
    const steps: readonly RoutineStep<unknown>[] = [
      ...pluginSteps,
      profiles,
      targetsStep,
      ...targets.flatMap((target) => target.steps),
      runArtifacts,
    ]
    const issues = targets.flatMap((target) => target.issues)

    yield* logInfo('Resolved application campaign routine', {
      readyStepCount: steps.filter((step) => step.status === 'ready').length,
      skippedStepCount: steps.filter((step) => step.status === 'skipped')
        .length,
      targetCount: targets.length,
      warningCount: issues.length,
    })
    yield* Effect.forEach(
      issues,
      (issue) =>
        logWarning(issue.message, {
          jobHost: issue.targetUrl ? urlHost(issue.targetUrl) : undefined,
          step: issue.step,
        }),
      { discard: true }
    )

    return {
      issues,
      pluginSteps,
      profiles,
      runArtifacts,
      steps,
      targetsStep,
      targets,
    } satisfies CampaignRoutine
  }).pipe(
    withTelemetrySpan('application-campaign.routine.resolve', {
      targetCount: options.targets.length,
    })
  )
