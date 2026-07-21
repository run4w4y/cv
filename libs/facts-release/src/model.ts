import type { CvGenerationGuidanceV1 } from '@cv/contracts/document'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import type { Schema } from 'effect'

import type {
  FactsCurrentPointerV2Schema,
  FactsReleaseManifestV2Schema,
  FactsReleaseProvenanceSchema,
} from './schema'

export type FactsReleaseProvenance = Schema.Schema.Type<
  typeof FactsReleaseProvenanceSchema
>

export type FactsReleaseManifestV2 = Schema.Schema.Type<
  typeof FactsReleaseManifestV2Schema
>

export type FactsCurrentPointerV2 = Schema.Schema.Type<
  typeof FactsCurrentPointerV2Schema
>

export type FactsAssetSource = {
  readonly bytes: Uint8Array
  readonly fileName: string
  readonly id: string
  readonly sha256: string
}

export type CompileFactsReleaseInput = {
  readonly assets: ReadonlyArray<FactsAssetSource>
  readonly catalogues: ReadonlyArray<FactsCatalogueV1>
  readonly generationGuidance: CvGenerationGuidanceV1
  readonly provenance: FactsReleaseProvenance
}

export type FactsReleaseObjectKind =
  | 'asset'
  | 'catalogue'
  | 'generation-guidance'
  | 'manifest'

export type FactsReleaseObject = {
  readonly byteLength: number
  readonly bytes: Uint8Array
  readonly key: string
  readonly kind: FactsReleaseObjectKind
  readonly logicalId: string
  readonly mediaType: string
  readonly sha256: string
}

export const CompiledFactsReleaseTypeId: unique symbol = Symbol.for(
  '@cv/facts-release/CompiledFactsRelease'
)

export type CompiledFactsRelease = {
  readonly [CompiledFactsReleaseTypeId]: typeof CompiledFactsReleaseTypeId
  readonly catalogues: ReadonlyArray<FactsCatalogueV1>
  readonly generationGuidance: CvGenerationGuidanceV1
  readonly manifest: FactsReleaseManifestV2
  readonly manifestObject: FactsReleaseObject
  readonly objects: ReadonlyArray<FactsReleaseObject>
  readonly releaseId: string
}

export type PublishedFactsObject = {
  readonly byteLength: number
  readonly bytes: Uint8Array
  readonly cacheControl: string
  readonly key: string
  readonly mediaType: string
  readonly sha256: string
}
