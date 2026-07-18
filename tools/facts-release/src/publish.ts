import {
  type FactsReleaseAssetError,
  type FactsReleaseHashError,
  type FactsReleaseIntegrityError,
  type FactsReleasePublicationError,
  type FactsReleaseValidationError,
  publishFactsRelease,
} from '@cv/facts-release'
import { Effect } from 'effect'

import type { FactsPublisherConfig } from './config'
import type {
  FactsPublisherHttpError,
  FactsPublisherIntegrityError,
  FactsPublisherSourceError,
} from './errors'
import { type FactsPublisherFetch, makeFactsPublisherHttpClient } from './http'
import { compileFactsCheckout } from './source'

export type PublishFactsResult = {
  readonly channel: string
  readonly channelVersion: number
  readonly objectCount: number
  readonly releaseId: string
  readonly sourceCommit: string
  readonly status: 'activated' | 'already-active'
}

export type PublishFactsError =
  | FactsPublisherHttpError
  | FactsPublisherIntegrityError
  | FactsPublisherSourceError
  | FactsReleaseAssetError
  | FactsReleaseHashError
  | FactsReleaseIntegrityError
  | FactsReleasePublicationError
  | FactsReleaseValidationError

export const publishFactsCheckout = Effect.fn('FactsPublisher.publishCheckout')(
  (
    config: FactsPublisherConfig,
    fetchImplementation: FactsPublisherFetch = globalThis.fetch
  ): Effect.Effect<PublishFactsResult, PublishFactsError> =>
    Effect.gen(function* () {
      const bundle = yield* compileFactsCheckout(config.contentRoot, {
        compilerCommit: config.compilerCommit,
        compilerRepository: config.compilerRepository,
        sourceCommit: config.sourceCommit,
        sourceRepository: config.sourceRepository,
      })
      const client = makeFactsPublisherHttpClient(config, fetchImplementation)
      yield* publishFactsRelease(bundle, new Date().toISOString()).pipe(
        Effect.provide(client.targetLayer)
      )
      const current = yield* client.current()
      if (current.activeReleaseId === bundle.releaseId) {
        return {
          channel: config.channel,
          channelVersion: current.version,
          objectCount: bundle.objects.length,
          releaseId: bundle.releaseId,
          sourceCommit: config.sourceCommit,
          status: 'already-active',
        }
      }
      const activated = yield* client.activate(
        bundle.releaseId,
        current.version
      )
      return {
        channel: activated.name,
        channelVersion: activated.version,
        objectCount: bundle.objects.length,
        releaseId: bundle.releaseId,
        sourceCommit: config.sourceCommit,
        status: 'activated',
      }
    })
)
