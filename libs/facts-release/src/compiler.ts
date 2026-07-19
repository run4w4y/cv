import {
  type FactsCatalogueV1,
  FactsCatalogueV1Schema,
} from '@cv/contracts/facts'
import { Effect, Schema } from 'effect'

import {
  FactsReleaseAssetError,
  type FactsReleaseAssetIssue,
  type FactsReleaseHashError,
  FactsReleaseValidationError,
} from './errors'
import { encodeCanonicalJson } from './internal/canonical-json'
import { isSafeAssetFileName } from './internal/file-name'
import { contentAddress, sha256Hex } from './internal/hash'
import type {
  CompiledFactsRelease,
  CompileFactsReleaseInput,
  FactsAssetSource,
  FactsReleaseManifestV1,
  FactsReleaseObject,
} from './model'
import {
  FactsReleaseManifestV1Schema,
  FactsReleaseProvenanceSchema,
  factsReleaseManifestV1ContractId,
} from './schema'

export const factsCatalogueMediaType = 'application/vnd.cv.facts+json'
export const factsReleaseManifestMediaType =
  'application/vnd.cv.facts-release+json'

const compareText = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0

const byId = <Value extends { readonly id: string }>(
  left: Value,
  right: Value
) => compareText(left.id, right.id)

const normalizeCatalogue = (catalogue: FactsCatalogueV1): FactsCatalogueV1 => ({
  ...catalogue,
  assets: [...catalogue.assets].sort(byId),
  evidence: [...catalogue.evidence].sort(byId),
})

const decodeCatalogue = (input: unknown) =>
  Schema.decodeUnknownEffect(FactsCatalogueV1Schema)(input).pipe(
    Effect.map(normalizeCatalogue),
    Effect.mapError(
      (cause) =>
        new FactsReleaseValidationError({
          cause,
          context: 'catalogue',
          message: 'The authored facts catalogue is invalid.',
        })
    )
  )

const decodeProvenance = (input: unknown) =>
  Schema.decodeUnknownEffect(FactsReleaseProvenanceSchema)(input).pipe(
    Effect.mapError(
      (cause) =>
        new FactsReleaseValidationError({
          cause,
          context: 'provenance',
          message:
            'Facts release provenance must contain repository names and full Git commit hashes.',
        })
    )
  )

const catalogueSetError = (message: string) =>
  new FactsReleaseValidationError({
    cause: new Error(message),
    context: 'catalogue',
    message,
  })

const decodeCatalogues = (inputs: ReadonlyArray<unknown>) =>
  Effect.gen(function* () {
    const catalogues = yield* Effect.forEach(inputs, decodeCatalogue)
    if (catalogues.length === 0) {
      return yield* catalogueSetError(
        'A facts release must contain at least one configured locale catalogue.'
      )
    }
    catalogues.sort((left, right) => compareText(left.locale, right.locale))
    const duplicate = catalogues.find(
      (catalogue, index) =>
        catalogues.findIndex(
          (candidate) => candidate.locale === catalogue.locale
        ) !== index
    )
    if (duplicate) {
      return yield* catalogueSetError(
        `Facts catalogue locale ${duplicate.locale} was supplied more than once.`
      )
    }
    const baseline = catalogues[0]
    if (!baseline) {
      return yield* catalogueSetError(
        'A facts release must contain at least one configured locale catalogue.'
      )
    }
    const mismatchedAssets = catalogues.find(
      (catalogue) =>
        JSON.stringify(catalogue.assets) !== JSON.stringify(baseline.assets)
    )
    if (mismatchedAssets) {
      return yield* catalogueSetError(
        `Facts assets for locale ${mismatchedAssets.locale} do not match ${baseline.locale}.`
      )
    }
    return catalogues
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

const assetError = (
  assetId: string,
  issue: FactsReleaseAssetIssue,
  message: string,
  expected: string | null = null,
  actual: string | null = null
) => new FactsReleaseAssetError({ actual, assetId, expected, issue, message })

const validateFileName = (source: FactsAssetSource) => {
  return isSafeAssetFileName(source.fileName)
    ? Effect.void
    : Effect.fail(
        assetError(
          source.id,
          'invalid-file-name',
          `Asset "${source.id}" must use a safe leaf file name.`,
          null,
          source.fileName
        )
      )
}

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
      yield* validateFileName(source)
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

        const object = yield* objectFromBytes(
          source.bytes,
          'asset',
          asset.id,
          asset.mediaType
        )
        if (object.sha256 !== asset.sha256) {
          return yield* assetError(
            asset.id,
            'digest-mismatch',
            `Facts asset "${asset.id}" does not match its reviewed SHA-256 digest.`,
            asset.sha256,
            object.sha256
          )
        }

        return { object, source } satisfies CompiledAsset
      })
    )
  })

const descriptor = (object: FactsReleaseObject) => ({
  byteLength: object.byteLength,
  mediaType: object.mediaType,
  sha256: object.sha256,
})

const uniqueObjects = (objects: ReadonlyArray<FactsReleaseObject>) => {
  const byKey = new Map<string, FactsReleaseObject>()
  for (const object of objects) {
    if (!byKey.has(object.key)) {
      byKey.set(object.key, object)
    }
  }
  return [...byKey.values()]
}

export const compileFactsRelease = Effect.fn('FactsRelease.compile')(
  (
    input: CompileFactsReleaseInput
  ): Effect.Effect<
    CompiledFactsRelease,
    FactsReleaseAssetError | FactsReleaseHashError | FactsReleaseValidationError
  > =>
    Effect.gen(function* () {
      const catalogues = yield* decodeCatalogues(input.catalogues)
      const provenance = yield* decodeProvenance(input.provenance)
      const compiledCatalogues = yield* Effect.forEach(
        catalogues,
        (catalogue) =>
          encodeCanonicalJson(catalogue, 'catalogue').pipe(
            Effect.flatMap((bytes) =>
              objectFromBytes(
                bytes,
                'catalogue',
                catalogue.locale,
                factsCatalogueMediaType
              )
            ),
            Effect.map((object) => ({ catalogue, object }))
          )
      )
      const baseline = catalogues[0]
      if (!baseline) {
        return yield* catalogueSetError(
          'A facts release must contain at least one configured locale catalogue.'
        )
      }
      const assets = yield* compileAssets(baseline.assets, input.assets)

      const manifestInput: FactsReleaseManifestV1 = {
        $schema: factsReleaseManifestV1ContractId,
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
        provenance,
      }
      const manifest = yield* Schema.decodeUnknownEffect(
        FactsReleaseManifestV1Schema
      )(manifestInput).pipe(
        Effect.mapError(
          (cause) =>
            new FactsReleaseValidationError({
              cause,
              context: 'manifest',
              message: 'The compiled facts release manifest is invalid.',
            })
        )
      )
      const manifestBytes = yield* encodeCanonicalJson(manifest, 'manifest')
      const manifestObject = yield* objectFromBytes(
        manifestBytes,
        'manifest',
        'manifest',
        factsReleaseManifestMediaType
      )

      return {
        catalogues,
        manifest,
        manifestObject,
        objects: uniqueObjects([
          ...compiledCatalogues.map(({ object }) => object),
          ...assets.map((asset) => asset.object),
          manifestObject,
        ]),
        releaseId: `fr_${manifestObject.sha256}`,
      }
    })
)
