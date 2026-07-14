import { localeSchema, profileSlugSchema } from '@cv/content-core'
import { Effect, Schema } from 'effect'
import { ApplicationCampaignConfigError } from '../errors'
import { logDebug, urlHost, withTelemetrySpan } from '../telemetry'
import { readApplicationCampaignEnvConfig } from './env'
import {
  defaultCampaignConcurrency,
  defaultCampaignOutRoot,
  defaultCodexAnalysisModel,
  defaultCodexAnalysisReasoningEffort,
  defaultCodexRecommendationModel,
  defaultCodexRecommendationReasoningEffort,
  defaultContentRoot,
  defaultLocale,
  defaultPdfOutDir,
  type PrepareCampaignOptions,
  type PrepareCampaignOverrides,
} from './model'
import {
  resolveCampaignTargets,
  resolveExcludedProfiles,
  resolveProjectPath,
  resolveUrls,
  resolveWebBaseUrl,
} from './targets'

export const resolvePrepareCampaignOptions = (
  overrides: PrepareCampaignOverrides
) =>
  Effect.gen(function* () {
    const env = yield* readApplicationCampaignEnvConfig
    const urls = yield* resolveUrls({
      envUrls: env.urls,
      urlFileContents: overrides.urlFileContents,
      urls: overrides.urls,
    })
    const contentRoot = yield* resolveProjectPath(
      overrides.contentRoot ??
        env.contentRoot ??
        env.contentRootFallback ??
        defaultContentRoot
    )
    const { runOutDir, targets } = yield* resolveCampaignTargets({
      outDir: overrides.outDir,
      outRoot: overrides.outRoot ?? env.outRoot ?? defaultCampaignOutRoot,
      urls,
    })
    const pdfOutDir = yield* resolveProjectPath(
      overrides.pdfOutDir ?? env.pdfOutDir ?? defaultPdfOutDir
    )
    const webBaseUrl = yield* resolveWebBaseUrl({
      baseUrl: overrides.baseUrl,
      cvWebBaseUrl: env.cvWebBaseUrl,
      cvWebHost: env.cvWebHost,
      envBaseUrl: env.baseUrl,
      publicCvWebBaseUrl: env.publicCvWebBaseUrl,
    })
    const locale = yield* Schema.decodeUnknownEffect(localeSchema)(
      overrides.locale ?? env.locale ?? defaultLocale
    ).pipe(
      Effect.mapError(
        (cause) =>
          new ApplicationCampaignConfigError({
            cause,
            message: 'Invalid application campaign locale.',
          })
      )
    )
    const profile = overrides.profile
      ? yield* Schema.decodeUnknownEffect(profileSlugSchema)(
          overrides.profile
        ).pipe(
          Effect.mapError(
            (cause) =>
              new ApplicationCampaignConfigError({
                cause,
                message: 'Invalid application campaign profile.',
              })
          )
        )
      : undefined
    const campaign = {
      audience: overrides.audience,
      concurrency:
        overrides.concurrency ?? env.concurrency ?? defaultCampaignConcurrency,
      contentRoot,
      excludedProfiles: resolveExcludedProfiles({
        envProfiles: env.excludedProfiles,
        profiles: overrides.excludedProfiles,
      }),
      generate: overrides.generate ?? true,
      locale,
      materials: overrides.materials ?? env.materials ?? 'all',
      outDir: runOutDir,
      pdfOutDir,
      profile,
      registryConflictStrategy: overrides.registryConflictStrategy ?? 'prompt',
      skipBuild: overrides.skipBuild ?? false,
      skipPdf: overrides.skipPdf ?? false,
      targets,
      webBaseUrl,
    } satisfies PrepareCampaignOptions
    const advisor = {
      analysis: {
        model:
          overrides.analysisModel ??
          overrides.model ??
          env.analysisModel ??
          env.model ??
          defaultCodexAnalysisModel,
        reasoningEffort:
          overrides.analysisReasoningEffort ??
          overrides.reasoningEffort ??
          env.analysisReasoningEffort ??
          env.reasoningEffort ??
          defaultCodexAnalysisReasoningEffort,
      },
      binaryPath: overrides.codexBin ?? env.codexBin,
      recommendation: {
        model:
          overrides.recommendationModel ??
          overrides.model ??
          env.recommendationModel ??
          env.model ??
          defaultCodexRecommendationModel,
        reasoningEffort:
          overrides.recommendationReasoningEffort ??
          overrides.reasoningEffort ??
          env.recommendationReasoningEffort ??
          env.reasoningEffort ??
          defaultCodexRecommendationReasoningEffort,
      },
    }

    yield* logDebug('Resolved application campaign options', {
      concurrency: campaign.concurrency,
      excludedProfileCount: campaign.excludedProfiles?.length,
      excludedProfiles: campaign.excludedProfiles?.join(', '),
      generate: campaign.generate,
      hasFixedAudience: Boolean(campaign.audience),
      hasFixedProfile: Boolean(campaign.profile),
      hasWebBaseUrl: Boolean(campaign.webBaseUrl),
      jobHosts: campaign.targets
        .map((target) => urlHost(target.url))
        .join(', '),
      locale: campaign.locale,
      materials: campaign.materials,
      analysisModel: advisor.analysis.model,
      analysisReasoningEffort: advisor.analysis.reasoningEffort,
      outDir: campaign.outDir,
      pdfOutDir: campaign.pdfOutDir,
      skipBuild: campaign.skipBuild,
      skipPdf: campaign.skipPdf,
      targetCount: campaign.targets.length,
      recommendationModel: advisor.recommendation.model,
      recommendationReasoningEffort: advisor.recommendation.reasoningEffort,
      registryConflictStrategy: campaign.registryConflictStrategy,
    })

    return { advisor, campaign }
  }).pipe(
    withTelemetrySpan('application-campaign.config.resolve', {
      generate: overrides.generate ?? true,
      targetCount: overrides.urls?.length ?? 0,
    })
  )

export type ResolvedPrepareCampaignOptions = Effect.Success<
  ReturnType<typeof resolvePrepareCampaignOptions>
>
