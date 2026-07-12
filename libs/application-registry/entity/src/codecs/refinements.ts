import { Schema } from 'effect'

/**
 * Overrides a Drizzle-derived leaf codec while leaving select nullability and
 * update optionality to `drizzle-orm/effect-schema`.
 */
export const refineWith =
  <S extends Schema.Top>(schema: S) =>
  () =>
    schema

/**
 * Drizzle's current Effect Schema release requires a complete field codec when
 * a nullable insert column is refined directly.
 */
export const optionalNullable = <S extends Schema.Top>(schema: S) =>
  Schema.optional(Schema.UndefinedOr(Schema.NullOr(schema)))
