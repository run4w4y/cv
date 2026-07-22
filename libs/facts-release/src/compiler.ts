import {
  cvDocumentV1ContractId,
  cvGenerationGuidanceV1ContractId,
} from '@cv/contracts/document'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Effect } from 'effect'
import { groupBy, sortBy, uniqBy } from 'es-toolkit'

import {
  FactsReleaseAssetError,
  type FactsReleaseAssetIssue,
  type FactsReleaseHashError,
} from './errors'
import { encodeCanonicalJson } from './internal/canonical-json'
import { contentAddress, sha256Hex } from './internal/hash'
import type {
  CompiledFactsRelease,
  CompileFactsReleaseInput,
  FactsAssetSource,
  FactsReleaseManifestV2,
  FactsReleaseObject,
} from './model'
import { CompiledFactsReleaseTypeId } from './model'
import { factsReleaseManifestV2ContractId } from './schema'

export const factsCatalogueMediaType = 'application/vnd.cv.facts+json'
export const factsReleaseManifestMediaType =
  'application/vnd.cv.facts-release+json'
export const cvGenerationGuidanceMediaType =
  'application/vnd.cv.generation-guidance+json'

const normalizeCatalogue = (catalogue: FactsCatalogueV1): FactsCatalogueV1 => ({
  ...catalogue,
  assets: sortBy(catalogue.assets, ['id']),
  evidence: sortBy(catalogue.evidence, ['id']),
})

const objectFromBytes = (
  bytes: Uint8Array,
  kind: FactsReleaseObject['kind'],
  logicalId: string,
  mediaType: string
) =>
  sha256Hex(bytes).pipe(
    Effect.map(
      (sha256): FactsReleaseObject => ({
        byteLength: bytes.byteLength,
        bytes: bytes.slice(),
        key: contentAddress(sha256),
        kind,
        logicalId,
        mediaType,
        sha256,
      })
    )
  )

const objectFromKnownDigest = (
  bytes: Uint8Array,
  kind: FactsReleaseObject['kind'],
  logicalId: string,
  mediaType: string,
  sha256: string
): FactsReleaseObject => ({
  byteLength: bytes.byteLength,
  bytes: bytes.slice(),
  key: contentAddress(sha256),
  kind,
  logicalId,
  mediaType,
  sha256,
})

const assetError = (
  assetId: string,
  issue: FactsReleaseAssetIssue,
  message: string,
  expected: string | null = null,
  actual: string | null = null
) => new FactsReleaseAssetError({ actual, assetId, expected, issue, message })

const indexAssetSources = (sources: ReadonlyArray<FactsAssetSource>) =>
  Effect.gen(function* () {
    const indexed = new Map<string, FactsAssetSource>()
    for (const source of sources) {
      if (indexed.has(source.id)) {
        return yield* assetError(
          source.id,
          'duplicate-source',
          `Asset source "${source.id}" was supplied more than once.`
        )
      }
      indexed.set(source.id, {
        ...source,
        bytes: source.bytes.slice(),
      })
    }
    return indexed
  })

type CompiledAsset = {
  readonly object: FactsReleaseObject
  readonly source: FactsAssetSource
}

const compileAssets = (
  metadata: FactsCatalogueV1['assets'],
  sources: ReadonlyArray<FactsAssetSource>
) =>
  Effect.gen(function* () {
    const indexed = yield* indexAssetSources(sources)
    const expectedIds = new Set(metadata.map((asset) => asset.id))

    for (const source of indexed.values()) {
      if (!expectedIds.has(source.id)) {
        return yield* assetError(
          source.id,
          'unexpected-source',
          `Asset source "${source.id}" is not declared by the facts catalogue.`
        )
      }
    }

    return yield* Effect.forEach(metadata, (asset) =>
      Effect.gen(function* () {
        const source = indexed.get(asset.id)
        if (!source) {
          return yield* assetError(
            asset.id,
            'missing-source',
            `Facts asset "${asset.id}" has no supplied bytes.`
          )
        }

        if (source.sha256 !== asset.sha256) {
          return yield* assetError(
            asset.id,
            'digest-mismatch',
            `Facts asset "${asset.id}" does not match its compiled SHA-256 digest.`,
            asset.sha256,
            source.sha256
          )
        }

        const object = objectFromKnownDigest(
          source.bytes,
          'asset',
          asset.id,
          asset.mediaType,
          source.sha256
        )

        return { object, source } satisfies CompiledAsset
      })
    )
  })

const descriptor = (object: FactsReleaseObject) => ({
  byteLength: object.byteLength,
  mediaType: object.mediaType,
  sha256: object.sha256,
})

const uniqueAssetObjects = (assets: ReadonlyArray<CompiledAsset>) => {
  const groups = Object.values(groupBy(assets, ({ object }) => object.key))
  for (const group of groups) {
    const baseline = group[0]
    const conflict = baseline
      ? group.find(
          ({ object }) => object.mediaType !== baseline.object.mediaType
        )
      : undefined
    if (baseline && conflict) {
      return Effect.fail(
        assetError(
          conflict.source.id,
          'media-type-conflict',
          `Assets with digest ${baseline.object.sha256} must use the same media type.`,
          baseline.object.mediaType,
          conflict.object.mediaType
        )
      )
    }
  }
  return Effect.succeed(uniqBy(assets, ({ object }) => object.key))
}

export const compileFactsRelease = Effect.fn('FactsRelease.compile')(
  (
    input: CompileFactsReleaseInput
  ): Effect.Effect<
    CompiledFactsRelease,
    FactsReleaseAssetError | FactsReleaseHashError
  > =>
    Effect.gen(function* () {
      const catalogues = sortBy(input.catalogues.map(normalizeCatalogue), [
        'locale',
      ])
      const compiledCatalogues = yield* Effect.forEach(
        catalogues,
        (catalogue) =>
          objectFromBytes(
            encodeCanonicalJson(catalogue),
            'catalogue',
            catalogue.locale,
            factsCatalogueMediaType
          ).pipe(Effect.map((object) => ({ catalogue, object })))
      )
      const generationGuidanceObject = yield* objectFromBytes(
        encodeCanonicalJson(input.generationGuidance),
        'generation-guidance',
        cvGenerationGuidanceV1ContractId,
        cvGenerationGuidanceMediaType
      )
      const baseline = catalogues[0]
      if (!baseline) {
        return yield* Effect.die(
          'A facts release must contain at least one configured locale catalogue.'
        )
      }
      const assets = yield* compileAssets(baseline.assets, input.assets)
      const uniqueAssets = yield* uniqueAssetObjects(assets)

      const manifest: FactsReleaseManifestV2 = {
        $schema: factsReleaseManifestV2ContractId,
        assets: assets.map(({ object, source }) => ({
          fileName: source.fileName,
          id: source.id,
          object: descriptor(object),
        })),
        catalogues: compiledCatalogues.map(({ catalogue, object }) => ({
          locale: catalogue.locale,
          object: descriptor(object),
        })),
        factsContract: baseline.$schema,
        generationGuidance: {
          contract: cvGenerationGuidanceV1ContractId,
          documentContract: cvDocumentV1ContractId,
          object: descriptor(generationGuidanceObject),
        },
        provenance: input.provenance,
      }
      const manifestBytes = encodeCanonicalJson(manifest)
      const manifestObject = yield* objectFromBytes(
        manifestBytes,
        'manifest',
        'manifest',
        factsReleaseManifestMediaType
      )

      return {
        [CompiledFactsReleaseTypeId]: CompiledFactsReleaseTypeId,
        catalogues,
        generationGuidance: input.generationGuidance,
        manifest,
        manifestObject,
        objects: [
          ...compiledCatalogues.map(({ object }) => object),
          ...uniqueAssets.map(({ object }) => object),
          generationGuidanceObject,
          manifestObject,
        ],
        releaseId: `fr_${manifestObject.sha256}`,
      }
    })
)
