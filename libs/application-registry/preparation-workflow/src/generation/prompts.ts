import type {
  CvDocumentV1,
  CvGenerationGuidanceV1,
} from '@cv/contracts/document'
import type { EvidenceReference } from './evidence'
import type { StructuredGenerationPrompt } from './service'

export {
  type CvAuthoringSource,
  cvAuthoringSourceForGeneration,
} from './cv-bindings'
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
  readonly guidance: CvGenerationGuidanceV1
  readonly job: {
    readonly keywords: ReadonlyArray<string>
    readonly location: string | null
    readonly responsibilities: ReadonlyArray<string>
    readonly role: string
  }
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
    'Target role terminology and responsibilities:',
    formatted(input.job),
    'Return one document accepted by the supplied JSON Schema. Keep it concise enough for an ATS-readable CV of no more than two pages.',
  ].join('\n\n'),
})

export type CoverLetterGenerationInput = {
  readonly approvedCv: CvDocumentV1
  readonly evidence: ReadonlyArray<EvidenceReference>
  readonly job: {
    readonly company: string | null
    readonly keywords: ReadonlyArray<string>
    readonly location: string | null
    readonly responsibilities: ReadonlyArray<string>
    readonly role: string
  }
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
    'Target role terminology and responsibilities:',
    formatted(input.job),
    'Approved tailored CV for positioning and factual consistency:',
    formatted(input.approvedCv),
    'Selected reviewed evidence available for additional factual detail:',
    formatted(input.evidence),
    'Return only a document accepted by the supplied JSON Schema.',
  ].join('\n\n'),
})
