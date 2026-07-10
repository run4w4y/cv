import { Codex } from '@openai/codex-sdk'
import { Context, Effect, Layer, Schema } from 'effect'
import type { CodexReasoningEffort } from '../config/model'
import {
  ApplicationCampaignAiError,
  type ApplicationCampaignValidationError,
} from '../errors'
import { logDebug, logInfo, withTelemetrySpan } from '../telemetry'
import {
  parseCampaignProfileShortlistEffect,
  parseCampaignRecommendationEffect,
} from './recommendation'
import {
  type CampaignProfileShortlist,
  CampaignProfileShortlistSchema,
  type CampaignRecommendation,
  CampaignRecommendationSchema,
} from './schema'

export type ApplicationAdvisorRequest = {
  readonly allowedProfiles: readonly string[]
  readonly fixedProfile?: string
  readonly prompt: string
}

type CodexRunRequest = {
  readonly operation: string
  readonly outputSchema: unknown
  readonly prompt: string
}

export type CodexApplicationAdvisorOptions = {
  readonly binaryPath?: string
  readonly model: string
  readonly reasoningEffort: CodexReasoningEffort
  readonly workingDirectory: string
}

export class ApplicationAdvisor extends Context.Service<
  ApplicationAdvisor,
  {
    readonly shortlistProfiles: (
      request: ApplicationAdvisorRequest
    ) => Effect.Effect<
      CampaignProfileShortlist,
      ApplicationCampaignAiError | ApplicationCampaignValidationError
    >
    readonly recommend: (
      request: ApplicationAdvisorRequest
    ) => Effect.Effect<
      CampaignRecommendation,
      ApplicationCampaignAiError | ApplicationCampaignValidationError
    >
  }
>()('ApplicationAdvisor') {}

const codexOptions = (options: CodexApplicationAdvisorOptions) =>
  options.binaryPath
    ? {
        codexPathOverride: options.binaryPath,
      }
    : undefined

const codexThreadOptions = (options: CodexApplicationAdvisorOptions) => ({
  approvalPolicy: 'never' as const,
  model: options.model,
  modelReasoningEffort: options.reasoningEffort,
  networkAccessEnabled: false,
  sandboxMode: 'read-only' as const,
  webSearchMode: 'disabled' as const,
  workingDirectory: options.workingDirectory,
})

const formatAiErrorCause = (cause: unknown) =>
  cause instanceof Error ? cause.message : String(cause)

const outputSchema = <A>(schema: Schema.Schema<A>) =>
  Schema.toJsonSchemaDocument(schema).schema

const profileShortlistOutputSchema = outputSchema(
  CampaignProfileShortlistSchema
)
const recommendationOutputSchema = outputSchema(CampaignRecommendationSchema)

const runCodex = (
  codex: Codex,
  options: CodexApplicationAdvisorOptions,
  request: CodexRunRequest
) =>
  Effect.tryPromise({
    try: async () => {
      const thread = codex.startThread(codexThreadOptions(options))
      const turn = await thread.run(request.prompt, {
        outputSchema: request.outputSchema,
      })

      return turn.finalResponse.trim()
    },
    catch: (cause) =>
      new ApplicationCampaignAiError({
        cause,
        message: [
          `Could not get ${request.operation} from Codex:`,
          formatAiErrorCause(cause),
        ].join(' '),
      }),
  })

export const makeCodexApplicationAdvisorLayer = (
  options: CodexApplicationAdvisorOptions
) =>
  Layer.effect(
    ApplicationAdvisor,
    Effect.sync(() => {
      const codex = new Codex(codexOptions(options))

      return {
        shortlistProfiles: (request: ApplicationAdvisorRequest) =>
          Effect.gen(function* () {
            yield* logInfo('Asking Codex to shortlist application profiles', {
              allowedProfileCount: request.allowedProfiles.length,
              hasFixedProfile: Boolean(request.fixedProfile),
              model: options.model,
              promptChars: request.prompt.length,
              reasoningEffort: options.reasoningEffort,
            })

            const rawShortlist = yield* runCodex(codex, options, {
              operation: 'application profile shortlist',
              outputSchema: profileShortlistOutputSchema,
              prompt: request.prompt,
            })

            yield* logDebug('Received Codex profile shortlist response', {
              responseChars: rawShortlist.length,
            })

            const shortlist = yield* parseCampaignProfileShortlistEffect(
              rawShortlist,
              {
                allowedProfiles: request.allowedProfiles,
                fixedProfile: request.fixedProfile,
              }
            )

            yield* logInfo('Codex requested full profile context', {
              requestedProfiles: shortlist.profileShortlist
                .map((item) => item.profile)
                .join(', '),
              requestedProfileCount: shortlist.profileShortlist.length,
            })

            return shortlist
          }).pipe(
            withTelemetrySpan('application-campaign.advisor.shortlist', {
              allowedProfileCount: request.allowedProfiles.length,
              hasFixedProfile: Boolean(request.fixedProfile),
              model: options.model,
              reasoningEffort: options.reasoningEffort,
            })
          ),
        recommend: (request: ApplicationAdvisorRequest) =>
          Effect.gen(function* () {
            yield* logInfo('Asking Codex for application recommendation', {
              allowedProfileCount: request.allowedProfiles.length,
              hasFixedProfile: Boolean(request.fixedProfile),
              model: options.model,
              promptChars: request.prompt.length,
              reasoningEffort: options.reasoningEffort,
            })

            const rawRecommendation = yield* runCodex(codex, options, {
              operation: 'application recommendation',
              outputSchema: recommendationOutputSchema,
              prompt: request.prompt,
            })

            yield* logDebug('Received Codex recommendation response', {
              responseChars: rawRecommendation.length,
            })

            const recommendation = yield* parseCampaignRecommendationEffect(
              rawRecommendation,
              {
                allowedProfiles: request.allowedProfiles,
                fixedProfile: request.fixedProfile,
              }
            )

            yield* logInfo('Codex selected application profile', {
              confidence: recommendation.recommendation.confidence,
              profile: recommendation.recommendation.profile,
            })

            return recommendation
          }).pipe(
            withTelemetrySpan('application-campaign.advisor.recommend', {
              allowedProfileCount: request.allowedProfiles.length,
              hasFixedProfile: Boolean(request.fixedProfile),
              model: options.model,
              reasoningEffort: options.reasoningEffort,
            })
          ),
      }
    })
  )
