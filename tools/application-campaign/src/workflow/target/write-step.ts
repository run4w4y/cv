import { Effect } from 'effect'
import { writeCampaignArtifacts } from '../../artifacts/write-campaign'
import type { ApplicationCampaignRuntime } from '../../runtime'
import { type WorkflowStep, workflowOutput } from '../graph'
import { uniqueIssues } from '../issues'
import {
  targetAnalysisKey,
  targetArtifactManifestKey,
  targetDecisionsKey,
  targetJobKey,
  targetPreparedCampaignKey,
  targetRecommendationKey,
} from '../keys'
import { campaignWorkflowStepIds, targetWorkflowStepId } from '../step-ids'
import type { PreparedCampaign } from '../types'
import type { TargetGenerationSteps } from './generation-steps'
import type { TargetStepBuilderContext } from './model'
import { generatedFromOutputs, targetWorkflowIssue } from './results'

export const makeWriteArtifactsStep = (
  context: TargetStepBuilderContext,
  recommend: WorkflowStep<ApplicationCampaignRuntime>,
  generation: TargetGenerationSteps
): WorkflowStep<ApplicationCampaignRuntime> => {
  const { options, runId, targetRoutine } = context
  const { target } = targetRoutine

  return {
    dependsOn: [
      recommend.id,
      ...(generation.privateLink ? [generation.privateLink.id] : []),
      ...(generation.privatePdf ? [generation.privatePdf.id] : []),
    ],
    execute: ({ issues, outputs }) =>
      Effect.gen(function* () {
        const [analysis, decisions, job, recommendation] = yield* Effect.all([
          outputs.get(targetAnalysisKey),
          outputs.get(targetDecisionsKey),
          outputs.get(targetJobKey),
          outputs.get(targetRecommendationKey),
        ])
        const generated = generatedFromOutputs(outputs)
        const campaignIssues = uniqueIssues([
          ...targetRoutine.issues,
          ...issues.map((issue) => targetWorkflowIssue(issue, targetRoutine)),
        ])
        const campaign = {
          decisions,
          extensions: analysis.extensions,
          generated,
          issues: campaignIssues,
          outDir: target.outDir,
          recommendation,
          runId,
          status: campaignIssues.length > 0 ? 'partial' : 'succeeded',
          target,
        } satisfies PreparedCampaign

        const manifest = yield* writeCampaignArtifacts({
          decisions,
          extensions: campaign.extensions,
          generated,
          issues: campaignIssues,
          job,
          materialsMode: options.materials,
          outDir: target.outDir,
          recommendation,
          runId,
          routineSteps: targetRoutine.steps,
          status: campaign.status,
        })

        return [
          workflowOutput(targetPreparedCampaignKey, campaign),
          workflowOutput(targetArtifactManifestKey, manifest),
        ]
      }),
    failurePolicy: 'fail-target',
    id: targetWorkflowStepId(
      target.index,
      campaignWorkflowStepIds.target.writeArtifacts
    ),
    label: 'Write campaign artifacts',
    scope: 'target',
  }
}
