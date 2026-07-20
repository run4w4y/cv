import type {
  FactsAuthoringCompositionError,
  FactsAuthoringValidationError,
} from '@cv/facts-authoring'
import {
  cloudflareR2Endpoint,
  factsR2ObjectStoreLayer,
  factsR2PublicationTargetLayer,
} from '@cv/facts-r2'
import {
  type FactsReleaseAssetError,
  type FactsReleaseHashError,
  type FactsReleasePublicationError,
  type FactsReleasePublicationTarget,
  publishFactsRelease,
} from '@cv/facts-release'
import { Effect, Layer } from 'effect'
import type { FileSystem } from 'effect/FileSystem'
import type { Path } from 'effect/Path'

import type { FactsPublisherConfig } from './config'
import type { FactsPublisherSourceError } from './errors'
import { compileFactsCheckout } from './source'

export type PublishFactsResult = {
  readonly objectCount: number
  readonly releaseId: string
  readonly sourceCommit: string
  readonly status: 'activated' | 'already-active'
}

export type PublishFactsError =
  | FactsAuthoringCompositionError
  | FactsAuthoringValidationError
  | FactsPublisherSourceError
  | FactsReleaseAssetError
  | FactsReleaseHashError
  | FactsReleasePublicationError

const publicationLayer = (config: FactsPublisherConfig) =>
  factsR2PublicationTargetLayer.pipe(
    Layer.provide(
      factsR2ObjectStoreLayer({
        accessKeyId: config.r2AccessKeyId,
        bucket: config.r2Bucket,
        endpoint: cloudflareR2Endpoint(config.r2AccountId),
        secretAccessKey: config.r2SecretAccessKey,
      })
    )
  )

export const publishFactsCheckout = Effect.fn('FactsPublisher.publishCheckout')(
  (
    config: FactsPublisherConfig,
    targetLayer: Layer.Layer<FactsReleasePublicationTarget> = publicationLayer(
      config
    )
  ): Effect.Effect<PublishFactsResult, PublishFactsError, FileSystem | Path> =>
    Effect.gen(function* () {
      const bundle = yield* compileFactsCheckout(config.contentRoot, {
        compilerCommit: config.compilerCommit,
        compilerRepository: config.compilerRepository,
        sourceCommit: config.sourceCommit,
        sourceRepository: config.sourceRepository,
      })
      const publication = yield* publishFactsRelease(bundle).pipe(
        Effect.provide(targetLayer)
      )
      return {
        objectCount: publication.immutableObjectCount,
        releaseId: publication.releaseId,
        sourceCommit: config.sourceCommit,
        status: publication.status,
      }
    })
)
