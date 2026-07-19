import { Effect, Schedule, Schema } from 'effect'

import { WorkerEnv } from './bindings'

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

const retryTransientFailure = Schedule.exponential('50 millis').pipe(
  Schedule.upTo({ times: 2 })
)

export const invalidateCvCache = Effect.fn('CvCache.invalidate')(function* (
  invalidation: CvCacheInvalidation
) {
  const environment = yield* WorkerEnv
  const application = environment.CV_APP
  const secret = environment.CV_REVALIDATION_SECRET?.trim()

  if (application === undefined && !secret) {
    yield* Effect.logWarning(
      'CV cache invalidation skipped because its Worker binding or secret is not configured.'
    )
    return
  }

  if (application === undefined || !secret) {
    return yield* new CvCacheInvalidationError({
      cause: new Error('Incomplete CV cache invalidation configuration.'),
      message:
        'CV cache invalidation requires both the CV Worker binding and its revalidation secret.',
    })
  }

  yield* Effect.tryPromise({
    try: async () => {
      const response = await application.fetch(
        new Request('https://cv.internal/c/_internal/revalidate', {
          body: JSON.stringify(invalidation),
          headers: {
            authorization: `Bearer ${secret}`,
            'content-type': 'application/json',
          },
          method: 'POST',
        })
      )
      if (!response.ok) {
        throw new Error(
          `The CV Worker rejected cache invalidation with HTTP ${response.status}.`
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
})
