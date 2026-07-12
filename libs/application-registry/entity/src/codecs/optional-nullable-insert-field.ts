import { Schema } from 'effect'

/**
 * Keep the runtime codec and inferred Effect type aligned for nullable insert
 * columns. In drizzle-orm 1.0.0-rc.4, callback refinements are made optional at
 * runtime but not in `BuildSchema<'insert', ...>`, so the complete field schema
 * must carry both modifiers until that type-level mismatch is fixed.
 */
export const optionalNullableInsertField = <S extends Schema.Top>(schema: S) =>
  Schema.optional(Schema.UndefinedOr(Schema.NullOr(schema)))
