import type { AnalyticsDashboardData } from '@cv/analytics-core'
import { Context, Effect, Layer } from 'effect'
import * as HttpClient from 'effect/unstable/http/HttpClient'
import * as HttpClientRequest from 'effect/unstable/http/HttpClientRequest'

import { normalizeAliasedPaths } from './aliased-normalize'
import type { Error as ClientError } from './errors'
import { GraphQLError, HttpError, ParseError, RequestError } from './errors'
import { extractGraphqlErrors, normalizeResponses } from './normalize'
import { buildQuery, buildVariables } from './query'
import { resolveRange } from './range'
import type {
  AliasedPathData,
  Configuration as ConfigurationShape,
  Range,
  ReadAliasedPathsOptions,
} from './types'

export type Configuration = ConfigurationShape

export const Configuration = Context.Service<Configuration>(
  '@cv/cloudflare-analytics-client/Configuration'
)

export interface Interface {
  readonly readAliasedPaths: (
    options: ReadAliasedPathsOptions
  ) => Effect.Effect<AliasedPathData, ClientError>
  readonly readDashboard: (
    range: Range
  ) => Effect.Effect<AnalyticsDashboardData, ClientError>
}

export const Service = Context.Service<Interface>(
  '@cv/cloudflare-analytics-client/Client'
)

const previewBody = (body: string) => body.replace(/\s+/gu, ' ').slice(0, 220)

const parsePayload = (body: string) =>
  Effect.try({
    try: (): unknown => JSON.parse(body),
    catch: (cause) =>
      ParseError.fromCause({
        cause,
        message: 'Cloudflare GraphQL response was not valid JSON',
      }),
  })

const rejectGraphqlErrors = (payload: unknown) => {
  const messages = extractGraphqlErrors(payload)

  return messages.length > 0
    ? Effect.fail(new GraphQLError({ messages }))
    : Effect.succeed(payload)
}

const requestPayload = Effect.fn('CloudflareAnalytics.request')(function* (
  client: HttpClient.HttpClient,
  configuration: ConfigurationShape,
  range: Range,
  pathLike?: string
) {
  const request = yield* HttpClientRequest.post(configuration.endpoint).pipe(
    HttpClientRequest.acceptJson,
    HttpClientRequest.bearerToken(configuration.apiToken),
    HttpClientRequest.bodyJson({
      query: buildQuery(),
      variables: buildVariables(configuration, range, pathLike),
    }),
    Effect.mapError((cause) =>
      RequestError.fromCause({
        cause,
        message: 'Cloudflare analytics request body could not be encoded',
      })
    )
  )
  const response = yield* client.execute(request).pipe(
    Effect.mapError((cause) =>
      RequestError.fromCause({
        cause,
        message: 'Cloudflare analytics request failed before a response',
      })
    )
  )
  const body = yield* response.text.pipe(
    Effect.mapError((cause) =>
      RequestError.fromCause({
        cause,
        message: 'Cloudflare analytics response body could not be read',
      })
    )
  )

  if (response.status < 200 || response.status >= 300) {
    return yield* new HttpError({
      bodyPreview: previewBody(body),
      status: response.status,
    })
  }

  const payload = yield* parsePayload(body)
  return yield* rejectGraphqlErrors(payload)
})

const make = Effect.gen(function* () {
  const configuration = yield* Configuration
  const httpClient = yield* HttpClient.HttpClient

  const readDashboard = Effect.fn('CloudflareAnalytics.readDashboard')(
    (range: Range) =>
      resolveRange(range).pipe(
        Effect.flatMap(({ chunks, effectiveRange }) =>
          Effect.forEach(
            chunks,
            (chunk) => requestPayload(httpClient, configuration, chunk),
            { concurrency: 1 }
          ).pipe(
            Effect.flatMap((payloads) =>
              normalizeResponses(payloads, effectiveRange)
            )
          )
        )
      )
  )

  const readAliasedPaths = Effect.fn('CloudflareAnalytics.readAliasedPaths')(
    ({ aliases, pathLike, range }: ReadAliasedPathsOptions) =>
      resolveRange(range).pipe(
        Effect.flatMap(({ chunks, effectiveRange }) =>
          Effect.forEach(
            chunks,
            (chunk) =>
              requestPayload(httpClient, configuration, chunk, pathLike),
            { concurrency: 1 }
          ).pipe(
            Effect.flatMap((payloads) =>
              normalizeAliasedPaths(payloads, effectiveRange, aliases)
            )
          )
        )
      )
  )

  return Service.of({ readAliasedPaths, readDashboard })
})

export const layer = Layer.effect(Service, make)

export type { AnalyticsDashboardData as DashboardData } from '@cv/analytics-core'
export type { Error } from './errors'
export {
  describeError,
  GraphQLError,
  HttpError,
  NormalizeError,
  ParseError,
  RangeValidationError,
  RequestError,
} from './errors'
export type {
  AliasedPathData,
  AliasedPathRecord,
  PathAlias,
  Range,
  ReadAliasedPathsOptions,
} from './types'
export { defaultEndpoint } from './types'
