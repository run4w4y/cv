import type { CvGenerationGuidanceV1 } from '@cv/contracts/document'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { factsForGeneration } from './evidence'
import type { StructuredGenerationPrompt } from './service'

export {
  type EvidenceReference,
  type EvidenceReferenceKind,
  evidenceIdsForGeneration,
  evidenceReferencesForGeneration,
  factsForGeneration,
  type GenerationFactsCatalogue,
  resolveEvidenceReferences,
  reviewedFactIdsForGeneration,
} from './evidence'

export type CvDraftGenerationInput = {
  readonly factsCatalogue: FactsCatalogueV1
  readonly guidance: CvGenerationGuidanceV1
  readonly jobContext: unknown
  readonly locale: string
}

const formatted = (value: unknown): string => JSON.stringify(value, null, 2)

export const buildCvDraftGenerationRequest = (
  input: CvDraftGenerationInput
): StructuredGenerationPrompt => ({
  instructions: input.guidance.instruction,
  prompt: [
    `Requested locale: ${input.locale}`,
    'CV generation guidance:',
    formatted(input.guidance),
    'Current job posting snapshot:',
    formatted(input.jobContext),
    'Complete trusted facts catalogue:',
    formatted(factsForGeneration(input.factsCatalogue)),
    'Return one document accepted by the supplied JSON Schema. Keep it concise enough for an ATS-readable CV of no more than two pages.',
  ].join('\n\n'),
})

export type CoverLetterGenerationInput = {
  readonly factsCatalogue: FactsCatalogueV1
  readonly jobContext: unknown
  readonly locale: string
  readonly prompt: string
}

export const buildCoverLetterGenerationRequest = (
  input: CoverLetterGenerationInput
): StructuredGenerationPrompt => ({
  instructions:
    'Write a truthful cover letter. The trusted facts catalogue is the sole source of personal claims; obey embedded section, entry, and fact tailoring guidance, and use the job context only to tailor relevance.',
  prompt: [
    `Requested locale: ${input.locale}`,
    'User-authored cover-letter instructions:',
    input.prompt,
    'Current job posting snapshot:',
    formatted(input.jobContext),
    'Complete trusted facts catalogue:',
    formatted(factsForGeneration(input.factsCatalogue)),
    'Return only a document accepted by the supplied JSON Schema.',
  ].join('\n\n'),
})
