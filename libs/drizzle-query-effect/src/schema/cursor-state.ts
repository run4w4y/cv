import type { CursorStateCodec } from '@cv/drizzle-query'
import { Schema } from 'effect'

/**
 * Adapts an Effect Schema into the synchronous state codec used by cursor
 * pagination. The schema is defined once and validates the untrusted state
 * restored from a continuation token.
 */
export const schemaCursorState = <
  StateSchema extends Schema.Codec<unknown, unknown>,
>(
  schema: StateSchema
): CursorStateCodec<StateSchema['Type']> => ({
  encode: Schema.encodeUnknownSync(schema),
  decode: Schema.decodeUnknownSync(schema),
})
