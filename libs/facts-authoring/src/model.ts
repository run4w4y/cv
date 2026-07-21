import type { CvGenerationGuidanceV1 } from '@cv/contracts/document'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'

import type {
  FactAssetRegistrySource,
  FactEvidenceRegistrySource,
  FactsRepositoryConfigSource,
} from './schema'

export type FactsSectionModuleSource = {
  readonly locale: string
  readonly relativePath: string
  readonly value: unknown
}

export type FactsAuthoringCompilationInput = {
  readonly assetDigests: Readonly<Record<string, string>>
  readonly assets: unknown
  readonly config: unknown
  readonly evidence: unknown
  readonly generationGuidance: unknown
  readonly sections: ReadonlyArray<FactsSectionModuleSource>
}

export type DecodedFactsAuthoringCompilationInput = {
  readonly assetDigests: Readonly<Record<string, string>>
  readonly assets: FactAssetRegistrySource
  readonly config: FactsRepositoryConfigSource
  readonly evidence: FactEvidenceRegistrySource
  readonly generationGuidance: CvGenerationGuidanceV1
  readonly sections: ReadonlyArray<FactsSectionModuleSource>
}

export type FactsAuthoringCompilation = {
  readonly assets: FactAssetRegistrySource
  readonly catalogues: ReadonlyArray<FactsCatalogueV1>
  readonly config: FactsRepositoryConfigSource
  readonly evidence: FactEvidenceRegistrySource
  readonly generationGuidance: CvGenerationGuidanceV1
}
