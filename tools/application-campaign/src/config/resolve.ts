import { Effect } from 'effect'
import { rootDirectory } from '../paths'
import { logDebug, urlHost, withTelemetrySpan } from '../telemetry'
import { readApplicationCampaignEnvConfig } from './env'
import {
  defaultCampaignConcurrency,
  defaultCampaignOutRoot,
  defaultCodexModel,
  defaultCodexReasoningEffort,
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
      locale: overrides.locale ?? env.locale ?? defaultLocale,
      materials: overrides.materials ?? env.materials ?? 'all',
      outDir: runOutDir,
      pdfOutDir,
      profile: overrides.profile,
      skipBuild: overrides.skipBuild ?? false,
      skipPdf: overrides.skipPdf ?? false,
      targets,
      webBaseUrl,
    } satisfies PrepareCampaignOptions
    const advisor = {
      binaryPath: overrides.codexBin ?? env.codexBin,
      model: overrides.model ?? env.model ?? defaultCodexModel,
      reasoningEffort:
        overrides.reasoningEffort ??
        env.reasoningEffort ??
        defaultCodexReasoningEffort,
      workingDirectory: rootDirectory,
    }

    yield* logDebug('Resolved application campaign options', {
      concurrency: campaign.concurrency,
      excludedProfileCount: campaign.excludedProfiles.length,
      excludedProfiles: campaign.excludedProfiles.join(', '),
      generate: campaign.generate,
      hasFixedAudience: Boolean(campaign.audience),
      hasFixedProfile: Boolean(campaign.profile),
      hasWebBaseUrl: Boolean(campaign.webBaseUrl),
      jobHosts: campaign.targets
        .map((target) => urlHost(target.url))
        .join(', '),
      locale: campaign.locale,
      materials: campaign.materials,
      outDir: campaign.outDir,
      pdfOutDir: campaign.pdfOutDir,
      skipBuild: campaign.skipBuild,
      skipPdf: campaign.skipPdf,
      targetCount: campaign.targets.length,
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
