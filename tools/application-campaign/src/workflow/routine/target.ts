import type {
  PrepareCampaignOptions,
  PrepareCampaignTarget,
} from '../../config/model'
import type { CampaignPluginsService } from '../../plugins/service'
import { instantiateTargetWorkflowStep } from '../graph'
import { campaignWorkflowStepIds, targetWorkflowStepId } from '../step-ids'
import { readyRoutineStep, skippedRoutineStep } from './builders'
import type { CampaignTargetRoutine, RoutineStep } from './types'

const resolvePrivateLink = (
  options: PrepareCampaignOptions,
  target: PrepareCampaignTarget,
  recommendationStep: string
): CampaignTargetRoutine['privateLink'] => {
  const id = targetWorkflowStepId(
    target.index,
    campaignWorkflowStepIds.target.privateLink
  )

  if (!options.generate) {
    return skippedRoutineStep({
      dependsOn: [recommendationStep],
      id,
      label: 'Mint private CV link',
      reason: 'Private asset generation is disabled.',
    })
  }

  if (!options.webBaseUrl) {
    const issue = {
      message:
        'Private link and PDF generation skipped because no web base URL resolved. Pass --base-url or set APPLICATION_CAMPAIGN_BASE_URL, CV_WEB_BASE_URL, PUBLIC_CV_WEB_BASE_URL, or CV_WEB_HOST.',
      severity: 'warning' as const,
      step: id,
      targetUrl: target.url.href,
    }

    return skippedRoutineStep({
      dependsOn: [recommendationStep],
      id,
      issues: [issue],
      label: 'Mint private CV link',
      reason: issue.message,
    })
  }

  return readyRoutineStep({
    config: { webBaseUrl: options.webBaseUrl },
    dependsOn: [recommendationStep],
    id,
    label: 'Mint private CV link',
  })
}

const resolvePrivatePdf = (
  options: PrepareCampaignOptions,
  target: PrepareCampaignTarget,
  privateLink: CampaignTargetRoutine['privateLink']
): CampaignTargetRoutine['privatePdf'] => {
  const id = targetWorkflowStepId(
    target.index,
    campaignWorkflowStepIds.target.privatePdf
  )

  if (privateLink.status === 'skipped') {
    return skippedRoutineStep({
      dependsOn: [privateLink.id],
      id,
      label: 'Export private PDF',
      reason: 'The private link dependency is unavailable.',
    })
  }

  if (options.skipPdf) {
    return skippedRoutineStep({
      dependsOn: [privateLink.id],
      id,
      label: 'Export private PDF',
      reason: 'Private PDF export is disabled.',
    })
  }

  return readyRoutineStep({
    config: privateLink.config,
    dependsOn: [privateLink.id],
    id,
    label: 'Export private PDF',
  })
}

export type ResolveTargetRoutineInput = {
  readonly analysisStepDependencies: readonly string[]
  readonly options: PrepareCampaignOptions
  readonly pluginSteps: CampaignPluginsService['targetSteps']
  readonly runStepIds: ReadonlySet<string>
  readonly target: PrepareCampaignTarget
}

export const resolveTargetRoutine = ({
  analysisStepDependencies,
  options,
  pluginSteps,
  runStepIds,
  target,
}: ResolveTargetRoutineInput): CampaignTargetRoutine => {
  const fetchJob = readyRoutineStep({
    config: undefined,
    id: targetWorkflowStepId(
      target.index,
      campaignWorkflowStepIds.target.fetchJob
    ),
    label: 'Fetch job posting',
  })
  const instantiatedPluginSteps = pluginSteps.map((step) =>
    instantiateTargetWorkflowStep(step, target, runStepIds)
  )
  const recommend = readyRoutineStep({
    config: { materials: options.materials },
    dependsOn: [
      campaignWorkflowStepIds.profiles,
      fetchJob.id,
      ...analysisStepDependencies.map((id) =>
        targetWorkflowStepId(target.index, id)
      ),
    ],
    id: targetWorkflowStepId(
      target.index,
      campaignWorkflowStepIds.target.recommend
    ),
    label: 'Analyze job and prepare recommendation',
  })
  const privateLink = resolvePrivateLink(options, target, recommend.id)
  const privatePdf = resolvePrivatePdf(options, target, privateLink)
  const writeArtifacts = readyRoutineStep({
    config: undefined,
    dependsOn: [
      recommend.id,
      ...(privateLink.status === 'ready' ? [privateLink.id] : []),
      ...(privatePdf.status === 'ready' ? [privatePdf.id] : []),
    ],
    id: targetWorkflowStepId(
      target.index,
      campaignWorkflowStepIds.target.writeArtifacts
    ),
    label: 'Write campaign artifacts',
  })
  const steps: readonly RoutineStep<unknown>[] = [
    fetchJob,
    recommend,
    privateLink,
    privatePdf,
    writeArtifacts,
    ...instantiatedPluginSteps.map((step) =>
      readyRoutineStep({
        config: undefined,
        dependsOn: step.dependsOn,
        id: step.id,
        label: step.label,
      })
    ),
  ]

  return {
    fetchJob,
    issues: steps.flatMap((step) => step.issues),
    privateLink,
    privatePdf,
    recommend,
    steps,
    target,
    writeArtifacts,
  }
}
