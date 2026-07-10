import { localeSchema, webBaseUrlSchema } from '@cv/content-core'
import { Config, Effect, Option } from 'effect'
import { ApplicationCampaignConfigError } from '../errors'
import {
  CampaignMaterialsModeSchema,
  CodexReasoningEffortSchema,
  PositiveIntegerSchema,
} from './model'

const optional = <A>(config: Config.Config<A>) =>
  config.pipe(Config.option, Config.map(Option.getOrUndefined))

export const readApplicationCampaignEnvConfig = Config.all({
  baseUrl: optional(
    Config.schema(webBaseUrlSchema, 'APPLICATION_CAMPAIGN_BASE_URL')
  ),
  codexBin: optional(Config.nonEmptyString('APPLICATION_CAMPAIGN_CODEX_BIN')),
  concurrency: optional(
    Config.schema(PositiveIntegerSchema, 'APPLICATION_CAMPAIGN_CONCURRENCY')
  ),
  contentRoot: optional(
    Config.nonEmptyString('APPLICATION_CAMPAIGN_CONTENT_ROOT')
  ),
  contentRootFallback: optional(Config.nonEmptyString('CONTENT_ROOT')),
  cvWebBaseUrl: optional(Config.schema(webBaseUrlSchema, 'CV_WEB_BASE_URL')),
  cvWebHost: optional(Config.nonEmptyString('CV_WEB_HOST')),
  excludedProfiles: optional(
    Config.string('APPLICATION_CAMPAIGN_EXCLUDED_PROFILES')
  ),
  locale: optional(Config.schema(localeSchema, 'APPLICATION_CAMPAIGN_LOCALE')),
  materials: optional(
    Config.schema(CampaignMaterialsModeSchema, 'APPLICATION_CAMPAIGN_MATERIALS')
  ),
  model: optional(Config.nonEmptyString('APPLICATION_CAMPAIGN_CODEX_MODEL')),
  outRoot: optional(Config.nonEmptyString('APPLICATION_CAMPAIGN_OUT_DIR')),
  pdfOutDir: optional(Config.nonEmptyString('APPLICATION_CAMPAIGN_PDF_DIR')),
  publicCvWebBaseUrl: optional(
    Config.schema(webBaseUrlSchema, 'PUBLIC_CV_WEB_BASE_URL')
  ),
  reasoningEffort: optional(
    Config.schema(
      CodexReasoningEffortSchema,
      'APPLICATION_CAMPAIGN_CODEX_REASONING_EFFORT'
    )
  ),
  urls: optional(Config.nonEmptyString('APPLICATION_CAMPAIGN_URLS')),
}).pipe(Effect.mapError(ApplicationCampaignConfigError.fromConfigError))
