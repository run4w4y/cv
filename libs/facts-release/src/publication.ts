import { Context, Effect } from 'effect'
import { factsReleaseManifestMediaType } from './compiler'
import type { FactsReleasePublicationError } from './errors'
import { verifyFactsReleaseBundle } from './integrity'
import { encodeCanonicalJson } from './internal/canonical-json'
import { sha256Hex } from './internal/hash'
import {
  factsAssetObjectKey,
  factsCurrentObjectKey,
  factsReleaseCatalogueObjectKey,
  factsReleaseManifestObjectKey,
} from './layout'
import type {
  CompiledFactsRelease,
  FactsCurrentPointerV1,
  PublishedFactsObject,
  PublishedFactsRelease,
} from './model'
import {
  FactsCurrentPointerV1Schema,
  factsCurrentPointerV1ContractId,
} from './schema'

const immutableCacheControl = 'private, max-age=31536000, immutable'
const currentCacheControl = 'private, no-cache'

export type FactsReleasePublicationTargetShape = {
  readonly putCurrent: (
    object: PublishedFactsObject
  ) => Effect.Effect<
    PublishedFactsRelease['status'],
    FactsReleasePublicationError
  >
  readonly putImmutable: (
    object: PublishedFactsObject
  ) => Effect.Effect<void, FactsReleasePublicationError>
}

export class FactsReleasePublicationTarget extends Context.Service<
  FactsReleasePublicationTarget,
  FactsReleasePublicationTargetShape
>()('@cv/facts-release/FactsReleasePublicationTarget') {}

const publishedObject = (
  object: CompiledFactsRelease['objects'][number],
  key: string
): PublishedFactsObject => ({
  byteLength: object.byteLength,
  bytes: object.bytes.slice(),
  cacheControl: immutableCacheControl,
  key,
  mediaType: object.mediaType,
  sha256: object.sha256,
})

const publishedManifest = (
  bundle: CompiledFactsRelease
): PublishedFactsObject =>
  publishedObject(
    bundle.manifestObject,
    factsReleaseManifestObjectKey(bundle.releaseId)
  )

const compilePointer = (bundle: CompiledFactsRelease) =>
  Effect.gen(function* () {
    const pointer: FactsCurrentPointerV1 = {
      $schema: factsCurrentPointerV1ContractId,
      manifest: {
        byteLength: bundle.manifestObject.byteLength,
        mediaType: factsReleaseManifestMediaType,
        sha256: bundle.manifestObject.sha256,
      },
      releaseId: bundle.releaseId,
    }
    const decoded = FactsCurrentPointerV1Schema.make(pointer)
    const bytes = yield* encodeCanonicalJson(decoded, 'manifest')
    const sha256 = yield* sha256Hex(bytes)
    return {
      pointer: decoded,
      object: {
        byteLength: bytes.byteLength,
        bytes,
        cacheControl: currentCacheControl,
        key: factsCurrentObjectKey,
        mediaType: 'application/json',
        sha256,
      } satisfies PublishedFactsObject,
    }
  })

export const publishFactsRelease = Effect.fn('FactsRelease.publish')(
  (
    bundle: CompiledFactsRelease
  ): Effect.Effect<
    PublishedFactsRelease,
    | import('./errors').FactsReleaseHashError
    | import('./errors').FactsReleaseIntegrityError
    | FactsReleasePublicationError
    | import('./errors').FactsReleaseValidationError,
    FactsReleasePublicationTarget
  > =>
    Effect.gen(function* () {
      yield* verifyFactsReleaseBundle(bundle)
      const target = yield* FactsReleasePublicationTarget
      const objects = bundle.objects.flatMap((object) => {
        if (object.kind === 'manifest') return []
        return [
          publishedObject(
            object,
            object.kind === 'asset'
              ? factsAssetObjectKey(object.sha256)
              : factsReleaseCatalogueObjectKey(
                  bundle.releaseId,
                  object.logicalId
                )
          ),
        ]
      })
      objects.push(publishedManifest(bundle))

      yield* Effect.forEach(objects, (object) => target.putImmutable(object), {
        discard: true,
      })
      const current = yield* compilePointer(bundle)
      const status = yield* target.putCurrent(current.object)
      return {
        immutableObjectCount: objects.length,
        pointer: current.pointer,
        releaseId: bundle.releaseId,
        status,
      }
    })
)
