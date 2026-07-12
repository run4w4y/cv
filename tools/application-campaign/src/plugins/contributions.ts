import { Schema } from 'effect'
import type { WorkflowOutputs } from '../workflow/graph'
import type {
  CampaignAnalysisContributionRegistration,
  CampaignAnalysisPromptContribution,
} from './types'

export const collectAnalysisPromptContributions = (
  outputs: WorkflowOutputs,
  registrations: readonly CampaignAnalysisContributionRegistration[]
) =>
  registrations.flatMap((registration) => {
    const contribution = outputs.getOption(registration.key)
    return contribution._tag === 'Some'
      ? [{ ...contribution.value, name: registration.name }]
      : []
  })

export const analysisExtensionSchemaFields = (
  contributions: readonly NamedCampaignAnalysisPromptContribution[]
) =>
  Object.fromEntries(
    contributions.map((contribution) => [
      contribution.name,
      contribution.schema,
    ])
  )

export const renderAnalysisExtensionInstructions = (
  contributions: readonly NamedCampaignAnalysisPromptContribution[]
) =>
  contributions
    .map((contribution) =>
      [
        `### ${contribution.name}`,
        `Return the requested value under \`extensions.${contribution.name}\`.`,
        contribution.instructions,
        `Expected JSON Schema: ${JSON.stringify(
          Schema.toJsonSchemaDocument(contribution.schema).schema
        )}`,
      ].join('\n')
    )
    .join('\n\n')
type NamedCampaignAnalysisPromptContribution =
  CampaignAnalysisPromptContribution & { readonly name: string }
