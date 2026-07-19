import { cvFactsV1ContractId } from '@cv/contracts/facts'
import { Schema } from 'effect'

import { isSafeAssetFileName } from './internal/file-name'

const NonEmptyTrimmedTextSchema = Schema.Trim.pipe(
  Schema.check(Schema.isNonEmpty())
)

const CommitSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u))
)

const Sha256Schema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/u))
)

const ObjectKeySchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^sha256\/[a-f0-9]{64}$/u))
)

const NonNegativeIntegerSchema = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
)

const MediaTypeSchema = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(
      /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+(?:\s*;\s*[^\s=]+=[^;]+)*$/iu
    )
  )
)

const AssetFileNameSchema = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter(isSafeAssetFileName, {
      message: 'Asset file name must be a safe leaf file name',
    })
  )
)

export const factsReleaseManifestV1ContractId = 'cv.facts-release.v1' as const

export const FactsReleaseProvenanceSchema = Schema.Struct({
  compiler: Schema.Struct({
    commit: CommitSchema,
    repository: NonEmptyTrimmedTextSchema,
  }),
  source: Schema.Struct({
    commit: CommitSchema,
    repository: NonEmptyTrimmedTextSchema,
  }),
}).annotate({
  identifier: 'FactsReleaseProvenance',
  parseOptions: { errors: 'all', onExcessProperty: 'error' },
})

const FactsReleaseObjectDescriptorV1StructureSchema = Schema.Struct({
  byteLength: NonNegativeIntegerSchema,
  key: ObjectKeySchema,
  mediaType: MediaTypeSchema,
  sha256: Sha256Schema,
})

export const FactsReleaseObjectDescriptorV1Schema =
  FactsReleaseObjectDescriptorV1StructureSchema.pipe(
    Schema.check(
      Schema.makeFilter(
        (descriptor) => descriptor.key === `sha256/${descriptor.sha256}`,
        { message: 'Object key must contain the declared SHA-256 digest' }
      )
    )
  ).annotate({ identifier: 'FactsReleaseObjectDescriptorV1' })

const FactsReleaseManifestV1StructureSchema = Schema.Struct({
  $schema: Schema.Literal(factsReleaseManifestV1ContractId),
  assets: Schema.Array(
    Schema.Struct({
      fileName: AssetFileNameSchema,
      id: NonEmptyTrimmedTextSchema,
      object: FactsReleaseObjectDescriptorV1Schema,
    })
  ),
  catalogues: Schema.Array(
    Schema.Struct({
      locale: NonEmptyTrimmedTextSchema,
      object: FactsReleaseObjectDescriptorV1Schema,
    })
  ).pipe(Schema.check(Schema.isMinLength(1))),
  factsContract: Schema.Literal(cvFactsV1ContractId),
  provenance: FactsReleaseProvenanceSchema,
})

type FactsReleaseManifestV1Structure = Schema.Schema.Type<
  typeof FactsReleaseManifestV1StructureSchema
>

const duplicateManifestAssetIssues = (
  manifest: FactsReleaseManifestV1Structure
): ReadonlyArray<Schema.FilterIssue> => {
  const seen = new Set<string>()
  return manifest.assets.flatMap((asset, index) => {
    if (seen.has(asset.id)) {
      return [
        {
          path: ['assets', index, 'id'],
          issue: `Duplicate manifest asset identifier: ${asset.id}`,
        },
      ]
    }
    seen.add(asset.id)
    return []
  })
}

const duplicateManifestLocaleIssues = (
  manifest: FactsReleaseManifestV1Structure
): ReadonlyArray<Schema.FilterIssue> => {
  const seen = new Set<string>()
  return manifest.catalogues.flatMap((catalogue, index) => {
    if (seen.has(catalogue.locale)) {
      return [
        {
          path: ['catalogues', index, 'locale'],
          issue: `Duplicate manifest catalogue locale: ${catalogue.locale}`,
        },
      ]
    }
    seen.add(catalogue.locale)
    return []
  })
}

export const FactsReleaseManifestV1Schema =
  FactsReleaseManifestV1StructureSchema.pipe(
    Schema.check(
      Schema.makeFilter((manifest) => [
        ...duplicateManifestAssetIssues(manifest),
        ...duplicateManifestLocaleIssues(manifest),
      ])
    )
  ).annotate({
    identifier: 'FactsReleaseManifestV1',
    parseOptions: { errors: 'all', onExcessProperty: 'error' },
  })
