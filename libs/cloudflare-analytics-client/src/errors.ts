import { Data } from 'effect'

export class CloudflareAnalyticsConfigError extends Data.TaggedError(
  'CloudflareAnalyticsConfigError'
)<{
  readonly cause?: { readonly message: string }
  readonly missing: readonly string[]
}> {
  override get message() {
    return this.missing.length > 0
      ? `Missing Cloudflare analytics env: ${this.missing.join(', ')}`
      : (this.cause?.message ?? 'Cloudflare analytics config is invalid')
  }

  static fromConfigError(cause: { readonly message: string }) {
    return new CloudflareAnalyticsConfigError({
      cause,
      missing: [],
    })
  }

  static missingEnv(missing: readonly string[]) {
    return new CloudflareAnalyticsConfigError({
      missing,
    })
  }
}

export class CloudflareAnalyticsRequestError extends Data.TaggedError(
  'CloudflareAnalyticsRequestError'
)<{
  readonly cause: string
  readonly message: string
}> {
  static fromCause({
    cause,
    message,
  }: {
    readonly cause: unknown
    readonly message: string
  }) {
    return new CloudflareAnalyticsRequestError({
      cause: normalizeCause(cause),
      message,
    })
  }
}

export class CloudflareAnalyticsHttpError extends Data.TaggedError(
  'CloudflareAnalyticsHttpError'
)<{
  readonly bodyPreview: string
  readonly status: number
}> {
  override get message() {
    return `Cloudflare GraphQL request failed with HTTP ${this.status}`
  }
}

export class CloudflareAnalyticsGraphQLError extends Data.TaggedError(
  'CloudflareAnalyticsGraphQLError'
)<{
  readonly messages: readonly string[]
}> {
  override get message() {
    return 'Cloudflare GraphQL returned analytics errors'
  }
}

export class CloudflareAnalyticsParseError extends Data.TaggedError(
  'CloudflareAnalyticsParseError'
)<{
  readonly cause: string
  readonly message: string
}> {
  static fromCause({
    cause,
    message,
  }: {
    readonly cause: unknown
    readonly message: string
  }) {
    return new CloudflareAnalyticsParseError({
      cause: normalizeCause(cause),
      message,
    })
  }
}

export class CloudflareAnalyticsNormalizeError extends Data.TaggedError(
  'CloudflareAnalyticsNormalizeError'
)<{
  readonly cause: string
  readonly message: string
}> {
  static fromCause({
    cause,
    message,
  }: {
    readonly cause: unknown
    readonly message: string
  }) {
    return new CloudflareAnalyticsNormalizeError({
      cause: normalizeCause(cause),
      message,
    })
  }
}

export class CloudflareAnalyticsRangeError extends Data.TaggedError(
  'CloudflareAnalyticsRangeError'
)<{
  readonly from: string
  readonly maxDays: number
  readonly message: string
  readonly to: string
}> {}

export type CloudflareAnalyticsError =
  | CloudflareAnalyticsConfigError
  | CloudflareAnalyticsRequestError
  | CloudflareAnalyticsHttpError
  | CloudflareAnalyticsGraphQLError
  | CloudflareAnalyticsParseError
  | CloudflareAnalyticsNormalizeError
  | CloudflareAnalyticsRangeError

export const normalizeCause = (cause: unknown) =>
  cause instanceof Error ? cause.message : String(cause)

export const describeCloudflareAnalyticsError = (
  error: CloudflareAnalyticsError
) =>
  error instanceof CloudflareAnalyticsGraphQLError
    ? `${error.message}: ${error.messages.join('; ')}`
    : error.message
