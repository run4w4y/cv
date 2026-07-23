import {
  Context,
  Effect,
  Layer,
  type Redacted as RedactedType,
  Schema,
} from 'effect'
import * as HttpClient from 'effect/unstable/http/HttpClient'
import * as HttpClientRequest from 'effect/unstable/http/HttpClientRequest'
import * as HttpClientResponse from 'effect/unstable/http/HttpClientResponse'

export class CacheInvalidationPermanentError extends Schema.TaggedErrorClass<CacheInvalidationPermanentError>()(
  'CacheInvalidationPermanentError',
  {
    cause: Schema.Defect(),
    message: Schema.String,
  }
) {}

export class CacheInvalidationTransientError extends Schema.TaggedErrorClass<CacheInvalidationTransientError>()(
  'CacheInvalidationTransientError',
  {
    cause: Schema.Defect(),
    message: Schema.String,
  }
) {}

export type CacheInvalidationError =
  | CacheInvalidationPermanentError
  | CacheInvalidationTransientError

export interface CacheInvalidatorShape {
  readonly invalidate: () => Effect.Effect<void, CacheInvalidationError>
}

export class CacheInvalidator extends Context.Service<
  CacheInvalidator,
  CacheInvalidatorShape
>()('@cv/application-registry-cache-invalidator/CacheInvalidator') {}

export interface CloudflareConfiguration {
  readonly apiToken: RedactedType.Redacted<string>
  readonly endpoint: URL
  readonly publicBaseUrl: URL
  readonly zoneId: string
}

const CloudflarePurgeResponseSchema = Schema.Struct({
  errors: Schema.Array(
    Schema.Struct({
      code: Schema.Number,
      message: Schema.String,
    })
  ),
  success: Schema.Boolean,
})

const permanentError = (cause: unknown, message: string) =>
  new CacheInvalidationPermanentError({ cause, message })

const transientError = (cause: unknown, message: string) =>
  new CacheInvalidationTransientError({ cause, message })

const transientStatus = (status: number) =>
  status === 408 || status === 429 || status >= 500

const cachePrefix = (publicBaseUrl: URL) => {
  const path = publicBaseUrl.pathname.replace(/\/?$/u, '/')
  return `${publicBaseUrl.host}${path}`
}

export const makeCloudflareCacheInvalidatorLayer = (
  configuration: CloudflareConfiguration
) =>
  Layer.effect(
    CacheInvalidator,
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient
      const invalidate = Effect.fn('CacheInvalidator.cloudflare')(function* () {
        const target = new URL(
          `zones/${encodeURIComponent(configuration.zoneId)}/purge_cache`,
          configuration.endpoint
        )
        const purge = Effect.gen(function* () {
          const request = yield* HttpClientRequest.post(target).pipe(
            HttpClientRequest.acceptJson,
            HttpClientRequest.bearerToken(configuration.apiToken),
            HttpClientRequest.bodyJson({
              prefixes: [cachePrefix(configuration.publicBaseUrl)],
            }),
            Effect.mapError((cause) =>
              permanentError(
                cause,
                'Cloudflare cache purge request could not be encoded.'
              )
            )
          )
          const response = yield* client
            .execute(request)
            .pipe(
              Effect.mapError((cause) =>
                transientError(cause, 'Cloudflare cache purge request failed.')
              )
            )
          if (response.status < 200 || response.status >= 300) {
            const cause = new Error(`HTTP ${response.status}`)
            const message = `Cloudflare rejected cache invalidation with HTTP ${response.status}.`
            return yield* Effect.fail(
              transientStatus(response.status)
                ? transientError(cause, message)
                : permanentError(cause, message)
            )
          }

          const result = yield* HttpClientResponse.schemaBodyJson(
            CloudflarePurgeResponseSchema
          )(response).pipe(
            Effect.mapError((cause) =>
              transientError(
                cause,
                'Cloudflare returned an invalid cache-purge response.'
              )
            )
          )
          if (!result.success) {
            return yield* Effect.fail(
              transientError(
                result.errors,
                result.errors.map(({ message }) => message).join('; ') ||
                  'Cloudflare did not purge the CV cache.'
              )
            )
          }
        })

        return yield* purge.pipe(
          Effect.timeout('30 seconds'),
          Effect.catchTag('TimeoutError', (cause) =>
            Effect.fail(
              transientError(cause, 'Cloudflare cache purge request timed out.')
            )
          )
        )
      })

      return CacheInvalidator.of({ invalidate })
    })
  )
