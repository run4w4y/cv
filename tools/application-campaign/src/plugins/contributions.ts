import { OpenAiStructuredOutput } from 'effect/unstable/ai'
import type { WorkflowOutputs } from '../workflow/graph'
import type {
  CampaignAnalysisContributionRegistration,
  CampaignAnalysisPromptContribution,
  CampaignRecommendationContributionRegistration,
  CampaignRecommendationPromptContribution,
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
          OpenAiStructuredOutput.toCodecOpenAI(contribution.schema).jsonSchema
        )}`,
      ].join('\n')
    )
    .join('\n\n')
type NamedCampaignAnalysisPromptContribution =
  CampaignAnalysisPromptContribution & { readonly name: string }

export const collectRecommendationPromptContributions = (
  outputs: WorkflowOutputs,
  registrations: readonly CampaignRecommendationContributionRegistration[]
) =>
  registrations.flatMap((registration) => {
    const contribution = outputs.getOption(registration.key)
    return contribution._tag === 'Some'
      ? [{ ...contribution.value, name: registration.name }]
      : []
  })

export const recommendationExtensionSchemaFields = (
  contributions: readonly NamedCampaignRecommendationPromptContribution[]
) =>
  Object.fromEntries(
    contributions.map((contribution) => [
      contribution.name,
      contribution.schema,
    ])
  )

export const renderRecommendationExtensionInstructions = (
  contributions: readonly NamedCampaignRecommendationPromptContribution[]
) =>
  contributions.length === 0
    ? 'No campaign plugins requested final recommendation fields. Return an empty extensions object.'
    : contributions
        .map((contribution) =>
          [
            `### ${contribution.name}`,
            `Return the requested value under \`extensions.${contribution.name}\`.`,
            contribution.instructions,
            `Expected JSON Schema: ${JSON.stringify(
              OpenAiStructuredOutput.toCodecOpenAI(contribution.schema)
                .jsonSchema
            )}`,
          ].join('\n')
        )
        .join('\n\n')

type NamedCampaignRecommendationPromptContribution =
  CampaignRecommendationPromptContribution & { readonly name: string }
