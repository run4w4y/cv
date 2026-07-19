import { Option, Schema, SchemaAST } from 'effect'

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

export interface GenerationGuidanceItem extends GenerationGuidance {
  readonly pointer: string
  readonly title: string | null
}

const appendJsonPointer = (pointer: string, segment: PropertyKey): string => {
  const encoded = String(segment).replaceAll('~', '~0').replaceAll('/', '~1')
  return `${pointer}/${encoded}`
}

/**
 * Reads generation annotations from the Effect Schema AST without serializing
 * the contract to JSON Schema and then attempting to infer its structure again.
 */
export const collectGenerationGuidance = (
  schema: Schema.Top
): ReadonlyArray<GenerationGuidanceItem> => {
  const items: Array<GenerationGuidanceItem> = []
  const active = new Set<SchemaAST.AST>()

  const visit = (ast: SchemaAST.AST, pointer: string): void => {
    if (active.has(ast)) return
    active.add(ast)
    try {
      const guidance = SchemaAST.resolveAt<GenerationGuidance>(
        GenerationGuidanceAnnotationId
      )(ast)
      if (guidance !== undefined) {
        items.push({
          ...guidance,
          pointer,
          title: SchemaAST.resolveTitle(ast) ?? null,
        })
      }

      switch (ast._tag) {
        case 'Arrays':
          ast.elements.forEach((element, index) => {
            visit(element, appendJsonPointer(pointer, index))
          })
          ast.rest.forEach((element, index) => {
            visit(element, appendJsonPointer(pointer, index))
          })
          break
        case 'Objects':
          ast.propertySignatures.forEach((field) => {
            visit(field.type, appendJsonPointer(pointer, field.name))
          })
          ast.indexSignatures.forEach((field) => {
            visit(field.type, pointer)
          })
          break
        case 'Union':
          ast.types.forEach((member) => {
            visit(member, pointer)
          })
          break
        case 'Suspend':
          visit(ast.thunk(), pointer)
          break
        case 'Declaration':
          ast.typeParameters.forEach((parameter) => {
            visit(parameter, pointer)
          })
          break
      }
    } finally {
      active.delete(ast)
    }
  }

  visit(schema.ast, '')
  return items
}
