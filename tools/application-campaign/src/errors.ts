import { type Config, Data } from 'effect'

export class ApplicationCampaignConfigError extends Data.TaggedError(
  'ApplicationCampaignConfigError'
)<{
  readonly cause?: unknown
  readonly message: string
}> {
  static fromConfigError(cause: Config.ConfigError) {
    return new ApplicationCampaignConfigError({
      cause,
      message: cause.message,
    })
  }
}

export class ApplicationCampaignValidationError extends Data.TaggedError(
  'ApplicationCampaignValidationError'
)<{
  readonly cause?: unknown
  readonly message: string
}> {}

export class ApplicationCampaignFileSystemError extends Data.TaggedError(
  'ApplicationCampaignFileSystemError'
)<{
  readonly cause?: unknown
  readonly operation: string
  readonly path: string
  readonly message: string
}> {}

export class ApplicationCampaignNetworkError extends Data.TaggedError(
  'ApplicationCampaignNetworkError'
)<{
  readonly cause?: unknown
  readonly message: string
  readonly url: string
}> {}

export class ApplicationCampaignTemplateError extends Data.TaggedError(
  'ApplicationCampaignTemplateError'
)<{
  readonly cause?: unknown
  readonly message: string
  readonly templatePath: string
}> {}

export class ApplicationCampaignContentError extends Data.TaggedError(
  'ApplicationCampaignContentError'
)<{
  readonly cause?: unknown
  readonly message: string
}> {}

export class ApplicationCampaignAiError extends Data.TaggedError(
  'ApplicationCampaignAiError'
)<{
  readonly cause?: unknown
  readonly message: string
}> {}

export class ApplicationCampaignPluginError extends Data.TaggedError(
  'ApplicationCampaignPluginError'
)<{
  readonly cause?: unknown
  readonly message: string
  readonly pluginId: string
  readonly stage: string
}> {}
