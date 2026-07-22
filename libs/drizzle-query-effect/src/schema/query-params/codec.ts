import type { AnyQueryDefinition } from '@cv/drizzle-query'
import type { Effect, Schema } from 'effect'

import type { QuerySchemaDefinition } from '../query/index'
import { queryParamsSchema } from './schema'
import { fromSearchParams, toSearchParams } from './search-params'
import type {
  EncodedQueryParams,
  QueryParamsExtras,
  QueryParamsRequest,
  QueryParamsSchemaOptions,
} from './types'

/** One composed query-string boundary shared by servers and browser adapters. */
export type QuerySearchParamsCodec<
  Definition extends AnyQueryDefinition,
  Extras extends QueryParamsExtras,
> = {
  readonly schema: Schema.Codec<
    QueryParamsRequest<Definition, Extras>,
    EncodedQueryParams<Extras>
  >
  readonly encode: (
    request: QueryParamsRequest<Definition, Extras>
  ) => Effect.Effect<URLSearchParams, Schema.SchemaError>
  readonly decode: (
    input: URLSearchParams | string
  ) => Effect.Effect<QueryParamsRequest<Definition, Extras>, Schema.SchemaError>
}

/** Builds the schema and its browser-native encode/decode operations once. */
export const queryParamsCodec = <
  Definition extends AnyQueryDefinition,
  Extras extends QueryParamsExtras = Record<never, never>,
>(
  definition: QuerySchemaDefinition<Definition>,
  options: QueryParamsSchemaOptions<Extras> = {}
) => {
  const schema = queryParamsSchema(definition, options)
  return {
    schema,
    encode: (request: QueryParamsRequest<Definition, Extras>) =>
      toSearchParams(schema, request),
    decode: (input: URLSearchParams | string) =>
      fromSearchParams(schema, input),
  } satisfies QuerySearchParamsCodec<Definition, Extras>
}
