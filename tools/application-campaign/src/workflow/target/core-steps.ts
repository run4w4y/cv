import type { ApplicationCampaignRuntime } from '../../runtime'
import type { WorkflowStep } from '../graph'
import { makeAnalysisSteps } from './analysis-steps'
import { makeGenerationSteps } from './generation-steps'
import type { TargetStepBuilderContext } from './model'
import { makeWriteArtifactsStep } from './write-step'

export const coreTargetSteps = (
  context: TargetStepBuilderContext
): readonly WorkflowStep<ApplicationCampaignRuntime>[] => {
  const [fetchJob, recommend] = makeAnalysisSteps(context)
  const generation = makeGenerationSteps(context, recommend)
  const writeArtifacts = makeWriteArtifactsStep(context, recommend, generation)

  return [
    fetchJob,
    recommend,
    ...(generation.privateLink ? [generation.privateLink] : []),
    ...(generation.privatePdf ? [generation.privatePdf] : []),
    writeArtifacts,
  ]
}
