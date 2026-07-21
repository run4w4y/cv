import {
  cvDocumentV1ContractId,
  cvGenerationGuidanceV1ContractId,
} from '@cv/contracts/document'
import {
  cvFactsV1ContractId,
  MediaTypeSchema,
  SafeFileNameSchema,
} from '@cv/contracts/facts'
import { Schema } from 'effect'

const NonEmptyTrimmedTextSchema = Schema.Trim.pipe(
  Schema.check(Schema.isNonEmpty())
)

const CommitSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u))
)

const Sha256Schema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/u))
)

const NonNegativeIntegerSchema = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
)

export const factsReleaseManifestV2ContractId = 'cv.facts-release.v2' as const

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

const FactsReleaseObjectDescriptorV2StructureSchema = Schema.Struct({
  byteLength: NonNegativeIntegerSchema,
  mediaType: MediaTypeSchema,
  sha256: Sha256Schema,
})

export const FactsReleaseObjectDescriptorV2Schema =
  FactsReleaseObjectDescriptorV2StructureSchema.annotate({
    identifier: 'FactsReleaseObjectDescriptorV2',
  })

const FactsReleaseManifestV2StructureSchema = Schema.Struct({
  $schema: Schema.Literal(factsReleaseManifestV2ContractId),
  assets: Schema.Array(
    Schema.Struct({
      fileName: SafeFileNameSchema,
      id: NonEmptyTrimmedTextSchema,
      object: FactsReleaseObjectDescriptorV2Schema,
    })
  ),
  catalogues: Schema.Array(
    Schema.Struct({
      locale: NonEmptyTrimmedTextSchema,
      object: FactsReleaseObjectDescriptorV2Schema,
    })
  ).pipe(Schema.check(Schema.isMinLength(1))),
  factsContract: Schema.Literal(cvFactsV1ContractId),
  generationGuidance: Schema.Struct({
    contract: Schema.Literal(cvGenerationGuidanceV1ContractId),
    documentContract: Schema.Literal(cvDocumentV1ContractId),
    object: FactsReleaseObjectDescriptorV2Schema,
  }),
  provenance: FactsReleaseProvenanceSchema,
})

type FactsReleaseManifestV2Structure = Schema.Schema.Type<
  typeof FactsReleaseManifestV2StructureSchema
>

const duplicateManifestAssetIssues = (
  manifest: FactsReleaseManifestV2Structure
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
  manifest: FactsReleaseManifestV2Structure
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

export const FactsReleaseManifestV2Schema =
  FactsReleaseManifestV2StructureSchema.pipe(
    Schema.check(
      Schema.makeFilter((manifest) => [
        ...duplicateManifestAssetIssues(manifest),
        ...duplicateManifestLocaleIssues(manifest),
      ])
    )
  ).annotate({
    identifier: 'FactsReleaseManifestV2',
    parseOptions: { errors: 'all', onExcessProperty: 'error' },
  })

export const factsCurrentPointerV2ContractId = 'cv.facts-current.v2' as const

const FactsReleaseIdSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^fr_[a-f0-9]{64}$/u))
)

const FactsCurrentPointerV2StructureSchema = Schema.Struct({
  $schema: Schema.Literal(factsCurrentPointerV2ContractId),
  manifest: FactsReleaseObjectDescriptorV2Schema,
  releaseId: FactsReleaseIdSchema,
})

export const FactsCurrentPointerV2Schema =
  FactsCurrentPointerV2StructureSchema.pipe(
    Schema.check(
      Schema.makeFilter(
        (pointer) => pointer.releaseId === `fr_${pointer.manifest.sha256}`,
        { message: 'Release ID must contain the manifest SHA-256 digest' }
      )
    )
  ).annotate({
    identifier: 'FactsCurrentPointerV2',
    parseOptions: { errors: 'all', onExcessProperty: 'error' },
  })
