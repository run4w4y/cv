import { ConflictError } from '@cv/application-registry-api-contract'
import { Effect } from 'effect'

import type { RegistryClient } from '../lib/registry-client'

/**
 * Moves an application out of `not_started` before preparation may read or
 * create any dependent context. Optimistic conflicts re-read the application;
 * a malformed successful response that remains `not_started` is treated as the
 * same bounded conflict instead of allowing bootstrap to continue.
 */
export const startApplicationPreparation = Effect.fn(
  'Preparation.startApplication'
)(
  function* (registry: RegistryClient['Service'], applicationId: string) {
    const application = yield* registry.registry.getApplication({
      params: { id: applicationId },
    })
    if (application.applicationStatus !== 'not_started') return application

    const updated = yield* registry.registry.patchApplication({
      params: { id: applicationId },
      payload: {
        applicationStatus: 'preparing',
        expectedVersion: application.version,
      },
    })
    if (updated.applicationStatus === 'not_started') {
      return yield* Effect.fail(
        ConflictError.make({
          message:
            'The application remained not started after beginning preparation.',
        })
      )
    }
    return updated
  },
  Effect.retry({
    times: 2,
    while: (error) => error._tag === 'ConflictError',
  })
)
