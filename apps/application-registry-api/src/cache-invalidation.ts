import { Context, Effect, Layer, Schedule, Schema } from 'effect'

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

const retryTransientFailure = Schedule.exponential('50 millis').pipe(
  Schedule.upTo({ times: 2 })
)

export const makeCvCacheInvalidatorLayer = (
  configuration: { readonly origin: URL; readonly secret: string } | undefined,
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
        if (configuration === undefined) {
          yield* Effect.logWarning(
            'CV cache invalidation skipped because its HTTP endpoint is not configured.'
          )
          return
        }

        const target = new URL('/c/_internal/revalidate', configuration.origin)
        yield* Effect.tryPromise({
          try: async () => {
            const response = await request(target, {
              body: JSON.stringify(invalidation),
              headers: {
                authorization: `Bearer ${configuration.secret}`,
                'content-type': 'application/json',
              },
              method: 'POST',
            })
            if (!response.ok) {
              throw new Error(
                `The CV application rejected cache invalidation with HTTP ${response.status}.`
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
