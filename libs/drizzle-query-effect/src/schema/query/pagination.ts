import type { ResolvedPaginationOptions } from '@cv/drizzle-query'
import { Schema } from 'effect'

import type { QuerySchemaDefinition } from './types'

type RuntimeSchema = Schema.Constraint

const positiveInteger = Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0)))

const paginationSizeSchema = (
  options: ResolvedPaginationOptions
): RuntimeSchema =>
  options.overflow === 'clamp'
    ? positiveInteger
    : positiveInteger.pipe(
        Schema.check(Schema.isLessThanOrEqualTo(options.maxSize))
      )

const paginationSchemas = {
  page: (size: RuntimeSchema) =>
    Schema.Struct({
      page: Schema.optional(positiveInteger),
      size: Schema.optional(size),
    }),
  cursor: (size: RuntimeSchema) =>
    Schema.Struct({
      after: Schema.optional(Schema.NonEmptyString),
      size: Schema.optional(size),
    }),
} satisfies Readonly<Record<string, (size: RuntimeSchema) => RuntimeSchema>>

/** @internal Resolves the request schema for a built-in pagination strategy. */
export const paginationRequestSchemaFor = (
  definition: QuerySchemaDefinition
): RuntimeSchema => {
  const options = definition.pagination.options
  if (options === undefined) {
    throw new TypeError(
      `Pagination "${definition.pagination.kind}" does not expose built-in schema metadata.`
    )
  }
  const makeSchema =
    paginationSchemas[
      definition.pagination.kind as keyof typeof paginationSchemas
    ]
  if (makeSchema === undefined) {
    throw new TypeError(
      `Pagination "${definition.pagination.kind}" has no derived Effect Schema.`
    )
  }
  return makeSchema(paginationSizeSchema(options))
}
