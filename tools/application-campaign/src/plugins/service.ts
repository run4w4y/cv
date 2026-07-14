import { Context, Effect, Layer } from 'effect'
import { ApplicationCampaignConfigError } from '../errors'
import type { WorkflowStep } from '../workflow/graph'
import type {
  CampaignAnalysisContributionRegistration,
  CampaignPlugin,
  CampaignRecommendationContributionRegistration,
} from './types'

export type CampaignPluginsService = {
  readonly analysisContributions: readonly CampaignAnalysisContributionRegistration[]
  readonly plugins: readonly CampaignPlugin[]
  readonly recommendationContributions: readonly CampaignRecommendationContributionRegistration[]
  readonly runSteps: readonly WorkflowStep<never>[]
  readonly targetSteps: readonly WorkflowStep<never>[]
}

const emptyPlugins: CampaignPluginsService = {
  analysisContributions: [],
  plugins: [],
  recommendationContributions: [],
  runSteps: [],
  targetSteps: [],
}

export const CampaignPlugins = Context.Reference<CampaignPluginsService>(
  '@cv/application-campaign/CampaignPlugins',
  { defaultValue: () => emptyPlugins }
)

export const makeCampaignPluginsService = (
  plugins: readonly CampaignPlugin[]
) =>
  Effect.gen(function* () {
    const ids = new Set<string>()

    for (const plugin of plugins) {
      const id = plugin.id.trim()

      if (!id || !/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/u.test(id)) {
        return yield* new ApplicationCampaignConfigError({
          message: `Campaign plugin id "${plugin.id}" must be a non-empty lower-case slug.`,
        })
      }

      if (ids.has(id)) {
        return yield* new ApplicationCampaignConfigError({
          message: `Campaign plugin id "${id}" is registered more than once.`,
        })
      }

      ids.add(id)

      const stepIds = new Set(plugin.steps.map((step) => step.id))
      for (const step of plugin.steps) {
        if (!step.id.startsWith(`${id}.`)) {
          return yield* new ApplicationCampaignConfigError({
            message: `Campaign plugin "${id}" step "${step.id}" must use the plugin id as its namespace.`,
          })
        }
        if (step.scope === 'run' && step.failurePolicy === 'fail-target') {
          return yield* new ApplicationCampaignConfigError({
            message: `Run-scoped campaign step "${step.id}" cannot use fail-target.`,
          })
        }
      }

      for (const contribution of plugin.analysisContributions ?? []) {
        if (!stepIds.has(contribution.stepId)) {
          return yield* new ApplicationCampaignConfigError({
            message: `Campaign analysis contribution "${contribution.name}" references missing step "${contribution.stepId}".`,
          })
        }
      }
      for (const contribution of plugin.recommendationContributions ?? []) {
        if (!stepIds.has(contribution.stepId)) {
          return yield* new ApplicationCampaignConfigError({
            message: `Campaign recommendation contribution "${contribution.name}" references missing step "${contribution.stepId}".`,
          })
        }
      }
    }

    const steps = plugins.flatMap((plugin) =>
      plugin.steps.map((step) => ({ ...step, owner: plugin.id }))
    )
    const analysisContributions = plugins.flatMap(
      (plugin) => plugin.analysisContributions ?? []
    )
    const recommendationContributions = plugins.flatMap(
      (plugin) => plugin.recommendationContributions ?? []
    )
    const contributionNames = new Set<string>()
    const resultKeys = new Set<string>()
    for (const contribution of analysisContributions) {
      if (contributionNames.has(contribution.name)) {
        return yield* new ApplicationCampaignConfigError({
          message: `Campaign analysis contribution "${contribution.name}" is registered more than once.`,
        })
      }
      if (resultKeys.has(contribution.resultKey.id)) {
        return yield* new ApplicationCampaignConfigError({
          message: `Campaign analysis output key "${contribution.resultKey.id}" is registered more than once.`,
        })
      }
      contributionNames.add(contribution.name)
      resultKeys.add(contribution.resultKey.id)
    }
    const recommendationNames = new Set<string>()
    const recommendationResultKeys = new Set<string>()
    for (const contribution of recommendationContributions) {
      if (recommendationNames.has(contribution.name)) {
        return yield* new ApplicationCampaignConfigError({
          message: `Campaign recommendation contribution "${contribution.name}" is registered more than once.`,
        })
      }
      if (recommendationResultKeys.has(contribution.resultKey.id)) {
        return yield* new ApplicationCampaignConfigError({
          message: `Campaign recommendation output key "${contribution.resultKey.id}" is registered more than once.`,
        })
      }
      recommendationNames.add(contribution.name)
      recommendationResultKeys.add(contribution.resultKey.id)
    }

    return {
      analysisContributions,
      plugins,
      recommendationContributions,
      runSteps: steps.filter((step) => step.scope === 'run'),
      targetSteps: steps.filter((step) => step.scope === 'target'),
    } satisfies CampaignPluginsService
  })

export const makeCampaignPluginsLayer = (plugins: readonly CampaignPlugin[]) =>
  Layer.effect(CampaignPlugins, makeCampaignPluginsService(plugins))
