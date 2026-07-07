import * as Effect from 'effect/Effect'
import * as Redacted from 'effect/Redacted'

import { readCloudflareAnalyticsConfigFromEnv } from './config'
import {
  CloudflareAnalyticsGraphQLError,
  CloudflareAnalyticsHttpError,
  CloudflareAnalyticsParseError,
  CloudflareAnalyticsRequestError,
} from './errors'
import {
  extractGraphqlErrorMessages,
  normalizeCloudflareAnalyticsResponses,
} from './normalize'
import {
  buildCloudflareAnalyticsQuery,
  buildCloudflareAnalyticsVariables,
} from './query'
import { resolveCloudflareAnalyticsRange } from './range'
import type {
  CloudflareAnalyticsConfig,
  CloudflareAnalyticsFetch,
  CloudflareAnalyticsRange,
  FetchCloudflareAnalyticsFromEnvOptions,
  FetchCloudflareAnalyticsOptions,
} from './types'

const previewBody = (body: string) => body.replace(/\s+/gu, ' ').slice(0, 220)

const parseJson = (text: string): unknown => JSON.parse(text)

type RequestCloudflareAnalyticsOptions = {
  readonly config: CloudflareAnalyticsConfig
  readonly fetchImplementation: CloudflareAnalyticsFetch
  readonly range: CloudflareAnalyticsRange
}

type CloudflareAnalyticsResponseBody = {
  readonly body: string
  readonly response: Response
}

const requestCloudflareAnalytics = ({
  config,
  fetchImplementation,
  range,
}: RequestCloudflareAnalyticsOptions) =>
  Effect.tryPromise({
    try: () =>
      fetchImplementation(config.endpoint, {
        body: JSON.stringify({
          query: buildCloudflareAnalyticsQuery(),
          variables: buildCloudflareAnalyticsVariables(config, range),
        }),
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${Redacted.value(config.apiToken)}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    catch: (cause) =>
      CloudflareAnalyticsRequestError.fromCause({
        cause,
        message: 'Cloudflare analytics request failed before a response',
      }),
  })

const readCloudflareAnalyticsResponseBody = (response: Response) =>
  Effect.tryPromise({
    try: () => response.text(),
    catch: (cause) =>
      CloudflareAnalyticsRequestError.fromCause({
        cause,
        message: 'Cloudflare analytics response body could not be read',
      }),
  }).pipe(Effect.map((body) => ({ body, response })))

const requireOkCloudflareAnalyticsResponse = ({
  body,
  response,
}: CloudflareAnalyticsResponseBody) =>
  response.ok
    ? Effect.succeed(body)
    : Effect.fail(
        new CloudflareAnalyticsHttpError({
          bodyPreview: previewBody(body),
          status: response.status,
        })
      )

const parseCloudflareAnalyticsPayload = (body: string) =>
  Effect.try({
    try: () => parseJson(body),
    catch: (cause) =>
      CloudflareAnalyticsParseError.fromCause({
        cause,
        message: 'Cloudflare GraphQL response was not valid JSON',
      }),
  })

const rejectGraphqlErrors = (payload: unknown) => {
  const graphqlErrors = extractGraphqlErrorMessages(payload)

  return graphqlErrors.length > 0
    ? Effect.fail(
        new CloudflareAnalyticsGraphQLError({ messages: graphqlErrors })
      )
    : Effect.succeed(payload)
}

const fetchCloudflareAnalyticsPayload = (
  options: RequestCloudflareAnalyticsOptions
) =>
  requestCloudflareAnalytics(options).pipe(
    Effect.flatMap(readCloudflareAnalyticsResponseBody),
    Effect.flatMap(requireOkCloudflareAnalyticsResponse),
    Effect.flatMap(parseCloudflareAnalyticsPayload),
    Effect.flatMap(rejectGraphqlErrors)
  )

export const fetchCloudflareAnalyticsDashboardData = ({
  config,
  fetch: fetchImplementation = fetch,
  range,
}: FetchCloudflareAnalyticsOptions) =>
  resolveCloudflareAnalyticsRange(range).pipe(
    Effect.flatMap(({ chunks, effectiveRange }) =>
      Effect.forEach(
        chunks,
        (chunk) =>
          fetchCloudflareAnalyticsPayload({
            config,
            fetchImplementation,
            range: chunk,
          }),
        { concurrency: 1 }
      ).pipe(
        Effect.flatMap((payloads) =>
          normalizeCloudflareAnalyticsResponses(payloads, effectiveRange)
        )
      )
    )
  )

export const fetchCloudflareAnalyticsDashboardDataFromEnv = ({
  endpoint,
  env,
  fetch: fetchImplementation,
  range,
}: FetchCloudflareAnalyticsFromEnvOptions) =>
  readCloudflareAnalyticsConfigFromEnv(env, endpoint).pipe(
    Effect.flatMap((config) =>
      fetchCloudflareAnalyticsDashboardData({
        config,
        fetch: fetchImplementation,
        range,
      })
    )
  )

export const fetchCloudflareAnalyticsDashboardDataFromEnvPromise = (
  options: FetchCloudflareAnalyticsFromEnvOptions
) => Effect.runPromise(fetchCloudflareAnalyticsDashboardDataFromEnv(options))
