import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import type { Schema } from 'effect'

import type {
  FactsCurrentPointerV1Schema,
  FactsReleaseManifestV1Schema,
  FactsReleaseProvenanceSchema,
} from './schema'

export type FactsReleaseProvenance = Schema.Schema.Type<
  typeof FactsReleaseProvenanceSchema
>

export type FactsReleaseManifestV1 = Schema.Schema.Type<
  typeof FactsReleaseManifestV1Schema
>

export type FactsCurrentPointerV1 = Schema.Schema.Type<
  typeof FactsCurrentPointerV1Schema
>

export type FactsAssetSource = {
  readonly bytes: Uint8Array
  readonly fileName: string
  readonly id: string
}

export type CompileFactsReleaseInput = {
  readonly assets: ReadonlyArray<FactsAssetSource>
  readonly catalogues: ReadonlyArray<unknown>
  readonly provenance: FactsReleaseProvenance
}

export type FactsReleaseObjectKind = 'asset' | 'catalogue' | 'manifest'

export type FactsReleaseObject = {
  readonly byteLength: number
  readonly bytes: Uint8Array
  readonly key: string
  readonly kind: FactsReleaseObjectKind
  readonly logicalId: string
  readonly mediaType: string
  readonly sha256: string
}

export type CompiledFactsRelease = {
  readonly catalogues: ReadonlyArray<FactsCatalogueV1>
  readonly manifest: FactsReleaseManifestV1
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

export type PublishedFactsRelease = {
  readonly immutableObjectCount: number
  readonly pointer: FactsCurrentPointerV1
  readonly releaseId: string
  readonly status: 'activated' | 'already-active'
}
