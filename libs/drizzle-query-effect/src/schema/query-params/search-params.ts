import { queryParamsFromRecord, queryParamsRecord } from '@cv/drizzle-query'
import { Effect, Schema } from 'effect'

/** Encodes a typed query request into browser-native `URLSearchParams`. */
export const toSearchParams = <Type, Encoded extends object, RD, RE>(
  schema: Schema.Codec<Type, Encoded, RD, RE>,
  request: Type
): Effect.Effect<URLSearchParams, Schema.SchemaError, RE> =>
  Schema.encodeEffect(schema)(request).pipe(Effect.map(queryParamsFromRecord))

/** Decodes a query string or `URLSearchParams` through a derived query codec. */
export const fromSearchParams = <Type, Encoded, RD, RE>(
  schema: Schema.Codec<Type, Encoded, RD, RE>,
  input: URLSearchParams | string
): Effect.Effect<Type, Schema.SchemaError, RD> =>
  Schema.decodeUnknownEffect(schema)(queryParamsRecord(input))
