import {
  Cache,
  Context,
  DateTime,
  Duration,
  Effect,
  Exit,
  Layer,
  type Schema,
} from 'effect'
import * as HttpClient from 'effect/unstable/http/HttpClient'
import * as HttpClientRequest from 'effect/unstable/http/HttpClientRequest'
import * as HttpClientResponse from 'effect/unstable/http/HttpClientResponse'

import { normalizeAliasedPaths } from './aliased-normalize'
import type { Error as ClientError } from './errors'
import {
  GraphQLError,
  HttpError,
  RequestError,
  ResponseError,
  ResultLimitError,
} from './errors'
import {
  buildLimitsVariables,
  buildQuery,
  buildVariables,
  limitsQuery,
} from './query'
import { splitRange } from './range'
import {
  type AnalyticsData,
  AnalyticsEnvelopeSchema,
  datasetLimitsFromData,
  type GraphqlEnvelope,
  LimitsEnvelopeSchema,
} from './schemas'
import type {
  AliasedPathData,
  Configuration as ConfigurationShape,
  DatasetLimits,
  Range,
  ReadAliasedPathsOptions,
} from './types'

export type Configuration = ConfigurationShape

export const Configuration = Context.Service<Configuration>(
  '@cv/cloudflare-analytics-client/Configuration'
)

export interface Interface {
  readonly readLimits: () => Effect.Effect<DatasetLimits, ClientError>
  readonly readAliasedPaths: (
    options: ReadAliasedPathsOptions
  ) => Effect.Effect<AliasedPathData, ClientError>
}

export const Service = Context.Service<Interface>(
  '@cv/cloudflare-analytics-client/Client'
)

const previewBody = (body: string) => body.replace(/\s+/gu, ' ').slice(0, 220)

const requestPayload = Effect.fn('CloudflareAnalytics.request')(function* <
  Data extends Schema.Constraint,
>(
  client: HttpClient.HttpClient,
  configuration: ConfigurationShape,
  query: string,
  variables: unknown,
  responseSchema: Data
) {
  const request = yield* HttpClientRequest.post(configuration.endpoint).pipe(
    HttpClientRequest.acceptJson,
    HttpClientRequest.bearerToken(configuration.apiToken),
    HttpClientRequest.bodyJson({
      query,
      variables,
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
  if (response.status < 200 || response.status >= 300) {
    const body = yield* response.text.pipe(
      Effect.mapError((cause) =>
        RequestError.fromCause({
          cause,
          message: 'Cloudflare analytics response body could not be read',
        })
      )
    )

    return yield* new HttpError({
      bodyPreview: previewBody(body),
      status: response.status,
    })
  }

  return yield* HttpClientResponse.schemaBodyJson(responseSchema)(
    response
  ).pipe(
    Effect.mapError(
      () =>
        new ResponseError({
          message:
            'Cloudflare GraphQL response was not valid JSON or did not match its expected contract',
        })
    )
  )
})

const requireGraphqlData = <Data>(
  envelope: GraphqlEnvelope<Data>
): Effect.Effect<Data, GraphQLError> => {
  if (envelope.errors !== null) {
    return Effect.fail(
      new GraphQLError({
        messages: envelope.errors.map(({ message }) => message),
      })
    )
  }

  return Effect.succeed(envelope.data)
}

const requestAnalyticsPayload = (
  client: HttpClient.HttpClient,
  configuration: ConfigurationShape,
  limits: DatasetLimits,
  range: Range
) =>
  requestPayload(
    client,
    configuration,
    buildQuery(limits.maxPageSize),
    buildVariables(configuration, range),
    AnalyticsEnvelopeSchema
  ).pipe(
    Effect.flatMap(requireGraphqlData),
    Effect.flatMap((payload) =>
      payload.viewer.zones.some(
        ({ dailyPaths }) => dailyPaths.length >= limits.maxPageSize
      )
        ? Effect.fail(new ResultLimitError({ maxPageSize: limits.maxPageSize }))
        : Effect.succeed(payload)
    )
  )

const make = Effect.gen(function* () {
  const configuration = yield* Configuration
  const httpClient = yield* HttpClient.HttpClient

  const limitsCache = yield* Cache.makeWith(
    (_dataset: 'httpRequestsAdaptiveGroups') =>
      requestPayload(
        httpClient,
        configuration,
        limitsQuery,
        buildLimitsVariables(configuration),
        LimitsEnvelopeSchema
      ).pipe(
        Effect.flatMap(requireGraphqlData),
        Effect.map(datasetLimitsFromData)
      ),
    {
      capacity: 1,
      timeToLive: (exit) => (Exit.isSuccess(exit) ? '1 hour' : Duration.zero),
    }
  )

  const readLimits = Effect.fn('CloudflareAnalytics.readLimits')(() =>
    Cache.get(limitsCache, 'httpRequestsAdaptiveGroups')
  )

  const readAliasedPaths = Effect.fn('CloudflareAnalytics.readAliasedPaths')(
    function* ({ aliases, range }: ReadAliasedPathsOptions) {
      if (aliases.length === 0) {
        const generatedAt = DateTime.formatIso(yield* DateTime.now)
        return normalizeAliasedPaths([], range, aliases, generatedAt)
      }

      const limits = yield* readLimits()
      const chunks = splitRange(range, limits.maxDurationMs)
      const payloads: AnalyticsData[] = yield* Effect.forEach(
        chunks,
        (chunk) =>
          requestAnalyticsPayload(httpClient, configuration, limits, chunk),
        { concurrency: 1 }
      )
      const generatedAt = DateTime.formatIso(yield* DateTime.now)

      return normalizeAliasedPaths(payloads, range, aliases, generatedAt)
    }
  )

  return Service.of({ readAliasedPaths, readLimits })
})

export const layer = Layer.effect(Service, make)

export type { Error } from './errors'
export { defaultEndpoint } from './types'
