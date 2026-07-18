import type { AiJsonGenerationRequest, AiJsonSchema } from '@cv/ai-provider'

export type CvDraftGenerationInput = {
  readonly factsCatalogue: unknown
  readonly guidance: unknown
  readonly jobContext: unknown
  readonly locale: string
  readonly modelId: string
  readonly schema: AiJsonSchema
}

const formatted = (value: unknown): string => JSON.stringify(value, null, 2)

export const buildCvDraftGenerationRequest = (
  input: CvDraftGenerationInput
): AiJsonGenerationRequest => ({
  instructions:
    'Build one truthful tailored CV document. Treat the supplied schema and guidance as authoritative. Use job context only for relevance and use the trusted facts catalogue as the sole source of factual claims.',
  modelId: input.modelId,
  prompt: [
    `Requested locale: ${input.locale}`,
    'Schema generation guidance:',
    formatted(input.guidance),
    'Current job posting snapshot:',
    formatted(input.jobContext),
    'Complete trusted facts catalogue:',
    formatted(input.factsCatalogue),
    'Return one document accepted by the supplied JSON Schema. Keep it concise enough for a one-page CV.',
  ].join('\n\n'),
  schema: input.schema,
  schemaDescription:
    'A truthful, one-page CV tailored to the supplied job from trusted facts.',
  schemaName: 'tailored_cv_document',
})

export type CoverLetterGenerationInput = {
  readonly factsCatalogue: unknown
  readonly jobContext: unknown
  readonly locale: string
  readonly modelId: string
  readonly prompt: string
  readonly schema: AiJsonSchema
}

export const buildCoverLetterGenerationRequest = (
  input: CoverLetterGenerationInput
): AiJsonGenerationRequest => ({
  instructions:
    'Write a truthful cover letter. The trusted facts catalogue is the sole source of personal claims; the job context is used only to tailor relevance.',
  modelId: input.modelId,
  prompt: [
    `Requested locale: ${input.locale}`,
    'User-authored cover-letter instructions:',
    input.prompt,
    'Current job posting snapshot:',
    formatted(input.jobContext),
    'Complete trusted facts catalogue:',
    formatted(input.factsCatalogue),
    'Return only a document accepted by the supplied JSON Schema.',
  ].join('\n\n'),
  schema: input.schema,
  schemaDescription: 'A tailored cover-letter document.',
  schemaName: 'cover_letter_document',
})
