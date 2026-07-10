import { Effect, Option, Schema } from 'effect'
import { Headers, HttpClient, HttpClientResponse } from 'effect/unstable/http'
import { ApplicationCampaignNetworkError } from './errors'
import { logDebug, logInfo, withTelemetrySpan } from './telemetry'

export const JobSourceSchema = Schema.Struct({
  body: Schema.String,
  contentType: Schema.optional(Schema.String),
  fetchedAt: Schema.String,
  url: Schema.String,
})

export type JobSource = Schema.Schema.Type<typeof JobSourceSchema>

export const fetchJobSource = (url: URL) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient

    yield* logInfo('Fetching job posting', { jobHost: url.host })

    const response = yield* client
      .get(url, {
        headers: {
          Accept: 'text/html,text/plain,application/xhtml+xml,*/*;q=0.8',
          'User-Agent': 'cv-application-campaign/0.1',
        },
      })
      .pipe(
        Effect.flatMap(HttpClientResponse.filterStatusOk),
        Effect.mapError(
          (cause) =>
            new ApplicationCampaignNetworkError({
              cause,
              message: `Could not fetch ${url.href}`,
              url: url.href,
            })
        )
      )

    const contentType = Option.getOrUndefined(
      Headers.get(response.headers, 'content-type')
    )
    const body = yield* response.text.pipe(
      Effect.mapError(
        (cause) =>
          new ApplicationCampaignNetworkError({
            cause,
            message: `Could not read job posting response body for ${url.href}`,
            url: url.href,
          })
      )
    )

    yield* logDebug('Fetched job posting body', {
      bodyChars: body.length,
      contentType: contentType ?? 'unknown',
    })

    return {
      body,
      contentType,
      fetchedAt: new Date().toISOString(),
      url: url.href,
    } satisfies JobSource
  }).pipe(
    withTelemetrySpan('application-campaign.job.fetch', {
      jobHost: url.host,
    })
  )
