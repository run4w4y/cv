import { Option, Schema } from 'effect'

/**
 * Identifies instructions that prompt builders and generic contract inspectors
 * can discover without knowing a concrete contract's fields.
 */
export const GenerationGuidanceAnnotationId = 'generationGuidance' as const

export const generationGuidanceSourceValues = [
  'trusted-facts',
  'job-context',
  'human-reviewed',
  'literal',
] as const

export type GenerationGuidanceSource =
  (typeof generationGuidanceSourceValues)[number]

export interface GenerationGuidance {
  /** Direct instruction for an author or model producing this value. */
  readonly instruction: string
  /** Inputs from which this value may be derived. */
  readonly sources: ReadonlyArray<GenerationGuidanceSource>
  /** Soft one-page writing budget. Structural validation does not count words. */
  readonly maxWords?: number
}

declare module 'effect/Schema' {
  namespace Annotations {
    interface Annotations {
      readonly generationGuidance?: GenerationGuidance | undefined
    }
  }
}

export const getGenerationGuidance = (
  schema: Schema.Top
): Option.Option<GenerationGuidance> =>
  Option.fromNullishOr(
    Schema.resolveAnnotations(schema)?.[GenerationGuidanceAnnotationId]
  )
