import {
  FactsReleasePublicationError,
  FactsReleasePublicationTarget,
} from '@cv/facts-release'
import { Effect, Layer } from 'effect'

import { FactsObjectStore } from './object-store'

const publicationError = (
  operation: FactsReleasePublicationError['operation'],
  cause: unknown
) =>
  new FactsReleasePublicationError({
    cause,
    message:
      operation === 'activate'
        ? 'Could not activate the compiled facts release in R2.'
        : 'Could not upload an immutable facts release object to R2.',
    operation,
  })

export const factsR2PublicationTargetLayer = Layer.effect(
  FactsReleasePublicationTarget,
  Effect.gen(function* () {
    const store = yield* FactsObjectStore
    return FactsReleasePublicationTarget.of({
      putCurrent: (object) =>
        store
          .putCurrent(object)
          .pipe(
            Effect.mapError((cause) => publicationError('activate', cause))
          ),
      putImmutable: (object) =>
        store
          .putImmutable(object)
          .pipe(Effect.mapError((cause) => publicationError('upload', cause))),
    })
  })
)
