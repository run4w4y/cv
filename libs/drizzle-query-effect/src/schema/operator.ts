import {
  type BinaryFilterOperator,
  type BinaryFilterOperatorOptions,
  binaryFilterOperator,
} from '@cv/drizzle-query'
import type { Schema } from 'effect'

/** Annotation key used to carry an Effect Schema through core metadata. */
export const effectSchemaAnnotation: unique symbol = Symbol.for(
  '@cv/drizzle-query-effect/filter-operator-schema'
)

/**
 * Defines a core binary filter operator and attaches the Effect Schema used to
 * validate and encode its right-hand-side value.
 *
 * The schema is stored under an Effect-owned symbol in the core operator's
 * opaque annotation map. The returned value therefore remains an ordinary
 * `@cv/drizzle-query` operator and the core runtime stays independent of
 * Effect.
 */
export const schemaBinaryFilterOperator = <
  const Name extends string,
  ValueSchema extends Schema.Codec<unknown, unknown>,
  Context = never,
>(
  name: Name,
  valueSchema: ValueSchema,
  options: BinaryFilterOperatorOptions<Schema.Schema.Type<ValueSchema>, Context>
): BinaryFilterOperator<Name, Schema.Schema.Type<ValueSchema>, Context> => {
  const annotations = new Map<symbol, unknown>(options.annotations)
  annotations.set(effectSchemaAnnotation, valueSchema)

  return binaryFilterOperator(name, {
    ...options,
    annotations,
  })
}
