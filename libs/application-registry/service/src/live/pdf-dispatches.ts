import { ArtifactsCrud } from '@cv/application-registry-crud'
import { Effect, Layer } from 'effect'

import { registryNow } from '../internal/shared'
import {
  PdfDispatchesService,
  type PdfDispatchesService as PdfDispatchesServiceShape,
} from '../services/pdf-dispatches'

const make = Effect.gen(function* () {
  const artifacts = yield* ArtifactsCrud

  return {
    markFailed: Effect.fn('PdfDispatchesService.markFailed')(
      (artifactId: string, message: string) =>
        Effect.gen(function* () {
          yield* artifacts.markDispatchFailed(
            artifactId,
            message.slice(0, 2_000),
            yield* registryNow
          )
        })
    ),
    markPublished: Effect.fn('PdfDispatchesService.markPublished')(
      (artifactId: string) =>
        Effect.gen(function* () {
          yield* artifacts.markDispatched(artifactId, yield* registryNow)
        })
    ),
    pending: Effect.fn('PdfDispatchesService.pending')((limit: number) =>
      artifacts.pendingDispatches(limit)
    ),
  } satisfies PdfDispatchesServiceShape
})

export const PdfDispatchesServiceLive = Layer.effect(PdfDispatchesService, make)
