import { Schema } from 'effect'

export class RequestError extends Schema.TaggedErrorClass<RequestError>()(
  'CloudflareAnalytics.RequestError',
  {
    cause: Schema.String,
    message: Schema.String,
  }
) {
  static fromCause({
    cause,
    message,
  }: {
    readonly cause: unknown
    readonly message: string
  }) {
    return new RequestError({ cause: normalizeCause(cause), message })
  }
}

export class HttpError extends Schema.TaggedErrorClass<HttpError>()(
  'CloudflareAnalytics.HttpError',
  {
    bodyPreview: Schema.String,
    status: Schema.Number,
  }
) {
  override get message() {
    return `Cloudflare GraphQL request failed with HTTP ${this.status}`
  }
}

export class GraphQLError extends Schema.TaggedErrorClass<GraphQLError>()(
  'CloudflareAnalytics.GraphQLError',
  {
    messages: Schema.Array(Schema.String),
  }
) {
  override get message() {
    return 'Cloudflare GraphQL returned analytics errors'
  }
}

export class ParseError extends Schema.TaggedErrorClass<ParseError>()(
  'CloudflareAnalytics.ParseError',
  {
    cause: Schema.String,
    message: Schema.String,
  }
) {
  static fromCause({
    cause,
    message,
  }: {
    readonly cause: unknown
    readonly message: string
  }) {
    return new ParseError({ cause: normalizeCause(cause), message })
  }
}

export class NormalizeError extends Schema.TaggedErrorClass<NormalizeError>()(
  'CloudflareAnalytics.NormalizeError',
  {
    cause: Schema.String,
    message: Schema.String,
  }
) {
  static fromCause({
    cause,
    message,
  }: {
    readonly cause: unknown
    readonly message: string
  }) {
    return new NormalizeError({ cause: normalizeCause(cause), message })
  }
}

export class RangeValidationError extends Schema.TaggedErrorClass<RangeValidationError>()(
  'CloudflareAnalytics.RangeValidationError',
  {
    from: Schema.String,
    maxDays: Schema.Number,
    message: Schema.String,
    to: Schema.String,
  }
) {}

export type Error =
  | RequestError
  | HttpError
  | GraphQLError
  | ParseError
  | NormalizeError
  | RangeValidationError

const normalizeCause = (cause: unknown) =>
  cause instanceof globalThis.Error ? cause.message : String(cause)

export const describeError = (error: Error) =>
  error instanceof GraphQLError
    ? `${error.message}: ${error.messages.join('; ')}`
    : error.message
