import { Context, Effect, Layer, type Schema } from 'effect'
import type {
  ApplicationCampaignAiError,
  ApplicationCampaignValidationError,
} from '../errors'
import { logInfo, withTelemetrySpan } from '../telemetry'
import {
  validateCampaignJobAnalysis,
  validateCampaignProfileShortlist,
  validateCampaignRecommendation,
} from './recommendation'
import {
  type CampaignJobAnalysis,
  type CampaignProfileShortlist,
  CampaignProfileShortlistSchema,
  type CampaignRecommendation,
  CampaignRecommendationSchema,
  makeCampaignJobAnalysisSchema,
} from './schema'
import {
  type CodexStructuredAiOptions,
  makeCodexStructuredAiLayer,
  StructuredAi,
  type StructuredAiService,
} from './structured'

export type { ProcessEnvironment } from './structured'
export {
  buildCodexOptions,
  buildCodexProcessEnv,
  buildCodexThreadOptions,
} from './structured'

export type ApplicationAdvisorRequest = {
  readonly allowedProfiles: readonly string[]
  readonly fixedProfile?: string
  readonly prompt: string
}

export type ApplicationJobAnalysisRequest = ApplicationAdvisorRequest & {
  readonly extensionSchemas: Readonly<
    Record<string, Schema.ConstraintDecoder<unknown, never>>
  >
}

export type CodexApplicationAdvisorOptions = CodexStructuredAiOptions

export class ApplicationAdvisor extends Context.Service<
  ApplicationAdvisor,
  {
    readonly analyzeJob: (
      request: ApplicationJobAnalysisRequest
    ) => Effect.Effect<
      CampaignJobAnalysis,
      ApplicationCampaignAiError | ApplicationCampaignValidationError
    >
    readonly recommend: (
      request: ApplicationAdvisorRequest
    ) => Effect.Effect<
      CampaignRecommendation,
      ApplicationCampaignAiError | ApplicationCampaignValidationError
    >
    readonly shortlistProfiles: (
      request: ApplicationAdvisorRequest
    ) => Effect.Effect<
      CampaignProfileShortlist,
      ApplicationCampaignAiError | ApplicationCampaignValidationError
    >
    readonly structured: StructuredAiService
  }
>()('ApplicationAdvisor') {}

export const ApplicationAdvisorLayer = Layer.effect(
  ApplicationAdvisor,
  Effect.gen(function* () {
    const structuredAi = yield* StructuredAi

    return {
      analyzeJob: (request: ApplicationJobAnalysisRequest) => {
        const schema = makeCampaignJobAnalysisSchema(
          Object.fromEntries(Object.entries(request.extensionSchemas))
        )

        return Effect.gen(function* () {
          yield* logInfo('Asking Codex to analyze job and shortlist profiles', {
            allowedProfileCount: request.allowedProfiles.length,
            extensionCount: Object.keys(request.extensionSchemas).length,
            hasFixedProfile: Boolean(request.fixedProfile),
          })
          const decoded = yield* structuredAi.run({
            operation: 'application job analysis',
            prompt: request.prompt,
            schema,
          })
          const analysis = {
            extensions: decoded.extensions,
            job: decoded.job,
            profileShortlist: decoded.profileShortlist,
          } satisfies CampaignJobAnalysis

          yield* validateCampaignJobAnalysis(analysis, request)
          yield* logInfo('Codex completed application job analysis', {
            extensionCount: Object.keys(analysis.extensions).length,
            requestedProfileCount: analysis.profileShortlist.length,
            requestedProfiles: analysis.profileShortlist
              .map((item) => item.profile)
              .join(', '),
          })

          return analysis
        }).pipe(
          withTelemetrySpan('application-campaign.advisor.analyze-job', {
            allowedProfileCount: request.allowedProfiles.length,
            extensionCount: Object.keys(request.extensionSchemas).length,
            hasFixedProfile: Boolean(request.fixedProfile),
          })
        )
      },
      recommend: (request: ApplicationAdvisorRequest) =>
        Effect.gen(function* () {
          yield* logInfo('Asking Codex for application recommendation', {
            allowedProfileCount: request.allowedProfiles.length,
            hasFixedProfile: Boolean(request.fixedProfile),
          })
          const recommendation = yield* structuredAi.run({
            operation: 'application recommendation',
            prompt: request.prompt,
            schema: CampaignRecommendationSchema,
          })
          yield* validateCampaignRecommendation(recommendation, request)
          yield* logInfo('Codex selected application profile', {
            confidence: recommendation.recommendation.confidence,
            profile: recommendation.recommendation.profile,
          })

          return recommendation
        }).pipe(
          withTelemetrySpan('application-campaign.advisor.recommend', {
            allowedProfileCount: request.allowedProfiles.length,
            hasFixedProfile: Boolean(request.fixedProfile),
          })
        ),
      shortlistProfiles: (request: ApplicationAdvisorRequest) =>
        Effect.gen(function* () {
          const shortlist = yield* structuredAi.run({
            operation: 'application profile shortlist',
            prompt: request.prompt,
            schema: CampaignProfileShortlistSchema,
          })

          return yield* validateCampaignProfileShortlist(shortlist, request)
        }),
      structured: structuredAi,
    }
  })
)

export const makeCodexApplicationAdvisorLayer = (
  options: CodexApplicationAdvisorOptions
) =>
  ApplicationAdvisorLayer.pipe(
    Layer.provide(makeCodexStructuredAiLayer(options))
  )
