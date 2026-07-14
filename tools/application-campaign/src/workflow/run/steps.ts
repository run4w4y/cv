import { buildPdfAssets } from '@cv/pdf-export'
import { DateTime, Effect } from 'effect'
import type { ApplicationAdvisor } from '../../ai/advisor'
import {
  toCampaignRunArtifact,
  writeCampaignRunArtifacts,
} from '../../artifacts/write-run'
import type { PrepareCampaignOptions } from '../../config/model'
import type { ApplicationCampaignRuntime } from '../../runtime'
import {
  type WorkflowExecutionIssue,
  type WorkflowStep,
  workflowOutput,
} from '../graph'
import { pluginWarning, uniqueIssues } from '../issues'
import {
  campaignPdfAssetsReadyKey,
  preparedCampaignRunKey,
  sharedCampaignInputsKey,
  targetCampaignResultsKey,
} from '../keys'
import { prepareSharedCampaignInputs } from '../profile-inputs'
import type { CampaignRoutine } from '../routine'
import { campaignWorkflowStepIds } from '../step-ids'
import { prepareCampaignTarget } from '../target'
import type { PreparedCampaignRun } from '../types'
import { campaignRunStatus } from './status'

export type CampaignWorkflowRuntime =
  | ApplicationCampaignRuntime
  | ApplicationAdvisor

export const runIssue = (issue: WorkflowExecutionIssue) =>
  pluginWarning({
    message: issue.message,
    pluginId: issue.owner ?? 'workflow',
    stage: issue.stepId,
  })

export type CoreRunStepsInput = {
  readonly options: PrepareCampaignOptions
  readonly targetRunDependencies: readonly string[]
  readonly routine: CampaignRoutine
  readonly runId: string
}

export const makeCoreRunSteps = ({
  options,
  routine,
  runId,
  targetRunDependencies,
}: CoreRunStepsInput): readonly WorkflowStep<CampaignWorkflowRuntime>[] => {
  const profiles: WorkflowStep<CampaignWorkflowRuntime> = {
    execute: () =>
      prepareSharedCampaignInputs(options).pipe(
        Effect.map((inputs) => [
          workflowOutput(sharedCampaignInputsKey, inputs),
        ])
      ),
    failurePolicy: 'fail-run',
    id: campaignWorkflowStepIds.profiles,
    label: routine.profiles.label,
    scope: 'run',
  }
  const targets: WorkflowStep<CampaignWorkflowRuntime> = {
    dependsOn: [
      profiles.id,
      ...targetRunDependencies,
      ...(routine.buildPdfAssets.status === 'ready'
        ? [routine.buildPdfAssets.id]
        : []),
    ],
    execute: ({ outputs }) =>
      Effect.gen(function* () {
        const shared = yield* outputs.get(sharedCampaignInputsKey)
        const campaigns = yield* Effect.forEach(
          routine.targets,
          (targetRoutine) =>
            prepareCampaignTarget({
              baseOutputs: outputs,
              candidateProfiles: shared.candidateProfiles,
              options,
              profileCatalog: shared.profileCatalog,
              profileSummaries: shared.profileSummaries,
              runId,
              targetRoutine,
            }),
          { concurrency: options.concurrency }
        )

        return [workflowOutput(targetCampaignResultsKey, campaigns)]
      }),
    failurePolicy: 'fail-run',
    id: campaignWorkflowStepIds.targets,
    label: routine.targetsStep.label,
    scope: 'run',
  }
  const runArtifacts: WorkflowStep<CampaignWorkflowRuntime> = {
    dependsOn: [targets.id],
    execute: ({ issues, outputs }) =>
      Effect.gen(function* () {
        const campaigns = yield* outputs.get(targetCampaignResultsKey)
        const result = {
          campaigns,
          issues: uniqueIssues([
            ...routine.issues,
            ...issues.map(runIssue),
            ...campaigns.flatMap((campaign) => campaign.issues),
          ]),
          outDir: options.outDir,
          routine,
          runId,
          status: campaignRunStatus(
            campaigns.map((campaign) => campaign.status)
          ),
        } satisfies PreparedCampaignRun

        yield* writeCampaignRunArtifacts({
          outDir: options.outDir,
          run: toCampaignRunArtifact(
            result,
            DateTime.formatIso(yield* DateTime.now)
          ),
        })
        return [workflowOutput(preparedCampaignRunKey, result)]
      }),
    failurePolicy: 'fail-run',
    id: campaignWorkflowStepIds.runArtifacts,
    label: routine.runArtifacts.label,
    scope: 'run',
  }

  const pdfAssetsRoutine = routine.buildPdfAssets
  const pdfAssets: WorkflowStep<CampaignWorkflowRuntime> | undefined =
    pdfAssetsRoutine.status === 'ready'
      ? {
          dependsOn: pdfAssetsRoutine.dependsOn,
          execute: () =>
            buildPdfAssets({
              webBaseUrl: pdfAssetsRoutine.config.webBaseUrl,
            }).pipe(
              Effect.as([workflowOutput(campaignPdfAssetsReadyKey, true)])
            ),
          failurePolicy: 'warn',
          id: pdfAssetsRoutine.id,
          label: pdfAssetsRoutine.label,
          scope: 'run',
        }
      : undefined

  return [profiles, ...(pdfAssets ? [pdfAssets] : []), targets, runArtifacts]
}
