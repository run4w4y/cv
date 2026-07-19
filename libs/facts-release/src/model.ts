import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import type { Schema } from 'effect'

import type {
  FactsReleaseManifestV1Schema,
  FactsReleaseProvenanceSchema,
} from './schema'

export type FactsReleaseProvenance = Schema.Schema.Type<
  typeof FactsReleaseProvenanceSchema
>

export type FactsReleaseManifestV1 = Schema.Schema.Type<
  typeof FactsReleaseManifestV1Schema
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

export type FactsReleaseRegistration = {
  readonly assets: ReadonlyArray<{
    readonly assetId: string
    readonly byteLength: number
    readonly fileName: string
    readonly mediaType: string
    readonly objectKey: string
    readonly releaseId: string
    readonly sha256: string
  }>
  readonly catalogs: ReadonlyArray<{
    readonly byteLength: number
    readonly locale: string
    readonly mediaType: string
    readonly objectKey: string
    readonly releaseId: string
    readonly sha256: string
  }>
  readonly release: {
    readonly compilerCommit: string
    readonly compilerRepository: string
    readonly createdAt: string
    readonly factsSchemaVersion: string
    readonly id: string
    readonly manifestByteLength: number
    readonly manifestObjectKey: string
    readonly manifestSha256: string
    readonly sourceCommit: string
    readonly sourceRepository: string
  }
}
