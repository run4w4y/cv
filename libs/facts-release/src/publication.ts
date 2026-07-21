import { Effect } from 'effect'

import { factsReleaseManifestMediaType } from './compiler'
import { encodeCanonicalJson } from './internal/canonical-json'
import { sha256Hex } from './internal/hash'
import {
  factsAssetObjectKey,
  factsCurrentObjectKey,
  factsReleaseCatalogueObjectKey,
  factsReleaseGenerationGuidanceObjectKey,
  factsReleaseManifestObjectKey,
} from './layout'
import type {
  CompiledFactsRelease,
  FactsCurrentPointerV2,
  PublishedFactsObject,
} from './model'
import { factsCurrentPointerV2ContractId } from './schema'

export const factsImmutableCacheControl =
  'private, max-age=31536000, immutable' as const
export const factsCurrentCacheControl = 'private, no-cache' as const

const publishedObject = (
  object: CompiledFactsRelease['objects'][number],
  key: string
): PublishedFactsObject => ({
  byteLength: object.byteLength,
  bytes: object.bytes.slice(),
  cacheControl: factsImmutableCacheControl,
  key,
  mediaType: object.mediaType,
  sha256: object.sha256,
})

export const compileFactsPublicationObjects = (
  release: CompiledFactsRelease
): ReadonlyArray<PublishedFactsObject> => {
  const objects = release.objects.flatMap((object) => {
    if (object.kind === 'manifest') return []
    const key =
      object.kind === 'asset'
        ? factsAssetObjectKey(object.sha256)
        : object.kind === 'catalogue'
          ? factsReleaseCatalogueObjectKey(release.releaseId, object.logicalId)
          : factsReleaseGenerationGuidanceObjectKey(release.releaseId)
    return [publishedObject(object, key)]
  })
  objects.push(
    publishedObject(
      release.manifestObject,
      factsReleaseManifestObjectKey(release.releaseId)
    )
  )
  return objects.toSorted((left, right) => left.key.localeCompare(right.key))
}

export const compileFactsCurrentPointerObject = Effect.fn(
  'FactsRelease.compileCurrentPointer'
)(function* (manifest: Pick<PublishedFactsObject, 'byteLength' | 'sha256'>) {
  const releaseId = `fr_${manifest.sha256}`
  const pointer: FactsCurrentPointerV2 = {
    $schema: factsCurrentPointerV2ContractId,
    manifest: {
      byteLength: manifest.byteLength,
      mediaType: factsReleaseManifestMediaType,
      sha256: manifest.sha256,
    },
    releaseId,
  }
  const bytes = encodeCanonicalJson(pointer)
  return {
    pointer,
    object: {
      byteLength: bytes.byteLength,
      bytes,
      cacheControl: factsCurrentCacheControl,
      key: factsCurrentObjectKey,
      mediaType: 'application/json',
      sha256: yield* sha256Hex(bytes),
    } satisfies PublishedFactsObject,
  }
})
