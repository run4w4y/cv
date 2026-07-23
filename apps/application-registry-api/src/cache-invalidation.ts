import {
  Context,
  Effect,
  Layer,
  Redacted,
  type Redacted as RedactedType,
  Schedule,
  Schema,
} from 'effect'

export type CvCacheInvalidation =
  | { readonly all: true }
  | { readonly token: string }

export class CvCacheInvalidationError extends Schema.TaggedErrorClass<CvCacheInvalidationError>()(
  'CvCacheInvalidationError',
  {
    cause: Schema.Defect(),
    message: Schema.String,
  }
) {}

export interface CvCacheInvalidatorShape {
  readonly invalidate: (
    invalidation: CvCacheInvalidation
  ) => Effect.Effect<void, CvCacheInvalidationError>
}

export class CvCacheInvalidator extends Context.Service<
  CvCacheInvalidator,
  CvCacheInvalidatorShape
>()('@cv/application-registry-api/CvCacheInvalidator') {}

export interface CvCacheInvalidatorConfiguration {
  readonly apiToken: RedactedType.Redacted<string>
  readonly endpoint: URL
  readonly host: string
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

const retryTransientFailure = Schedule.exponential('50 millis').pipe(
  Schedule.upTo({ times: 2 })
)

const purgeBody = (
  host: string,
  invalidation: CvCacheInvalidation
):
  | { readonly files: readonly string[] }
  | { readonly prefixes: readonly string[] } =>
  'token' in invalidation
    ? {
        files: [`https://${host}/c/${encodeURIComponent(invalidation.token)}`],
      }
    : { prefixes: [`${host}/c/`] }

export const makeCvCacheInvalidatorLayer = (
  configuration: CvCacheInvalidatorConfiguration,
  request: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response> = globalThis.fetch
) =>
  Layer.succeed(
    CvCacheInvalidator,
    CvCacheInvalidator.of({
      invalidate: Effect.fn('CvCacheInvalidator.invalidate')(function* (
        invalidation: CvCacheInvalidation
      ) {
        const target = new URL(
          `zones/${encodeURIComponent(configuration.zoneId)}/purge_cache`,
          configuration.endpoint
        )
        yield* Effect.tryPromise({
          try: async () => {
            const response = await request(target, {
              body: JSON.stringify(purgeBody(configuration.host, invalidation)),
              headers: {
                authorization: `Bearer ${Redacted.value(configuration.apiToken)}`,
                'content-type': 'application/json',
              },
              method: 'POST',
            })
            if (!response.ok) {
              throw new Error(
                `Cloudflare rejected cache invalidation with HTTP ${response.status}.`
              )
            }

            const result = await Schema.decodeUnknownPromise(
              CloudflarePurgeResponseSchema
            )(await response.json())
            if (!result.success) {
              throw new Error(
                result.errors.map(({ message }) => message).join('; ') ||
                  'Cloudflare did not purge the CV cache.'
              )
            }
          },
          catch: (cause) =>
            new CvCacheInvalidationError({
              cause,
              message:
                cause instanceof Error
                  ? cause.message
                  : 'The CV cache could not be invalidated.',
            }),
        }).pipe(Effect.retry({ schedule: retryTransientFailure }))
      }),
    })
  )
