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
    status: Schema.Int,
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

export class ResponseError extends Schema.TaggedErrorClass<ResponseError>()(
  'CloudflareAnalytics.ResponseError',
  {
    message: Schema.String,
  }
) {}

export class ResultLimitError extends Schema.TaggedErrorClass<ResultLimitError>()(
  'CloudflareAnalytics.ResultLimitError',
  {
    maxPageSize: Schema.Int,
  }
) {
  override get message() {
    return `Cloudflare analytics filled its ${this.maxPageSize}-row result page`
  }
}

export type Error =
  | RequestError
  | HttpError
  | GraphQLError
  | ResponseError
  | ResultLimitError

const normalizeCause = (cause: unknown) =>
  cause instanceof globalThis.Error ? cause.message : String(cause)
