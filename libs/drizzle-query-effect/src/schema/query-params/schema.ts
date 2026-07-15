import type { AnyQueryDefinition } from '@cv/drizzle-query'
import { Schema, SchemaGetter } from 'effect'

import {
  paginationRequestSchemaFor,
  type QuerySchemaDefinition,
  runtimeQueryRequestSchema,
} from '../query/index'
import type {
  EncodedQueryParams,
  QueryParamsExtras,
  QueryParamsRequest,
  QueryParamsSchemaOptions,
} from './types'

const reservedParameters = new Set([
  'filters',
  'orderBy',
  'pagination',
  'after',
  'page',
  'size',
])

const assertExtras = (extras: QueryParamsExtras): void => {
  for (const name of Object.keys(extras)) {
    if (reservedParameters.has(name)) {
      throw new TypeError(`The query parameter "${name}" is reserved.`)
    }
  }
}

const numberFromString = <S extends Schema.Constraint>(schema: S) =>
  Schema.NumberFromString.pipe(Schema.decodeTo(schema))

type FlatQuery = Readonly<Record<string, unknown>>

const decodeFlatQuery = (
  input: FlatQuery,
  paginationKind: string
): FlatQuery => {
  const { after, page, size, ...request } = input
  const pagination =
    paginationKind === 'page'
      ? page === undefined && size === undefined
        ? undefined
        : { page, size }
      : after === undefined && size === undefined
        ? undefined
        : { after, size }

  return pagination === undefined ? request : { ...request, pagination }
}

const encodeFlatQuery = (input: FlatQuery): FlatQuery => {
  const { pagination, ...query } = input
  return typeof pagination === 'object' && pagination !== null
    ? { ...query, ...pagination }
    : query
}

/**
 * Derives a bidirectional Effect Schema for HTTP query parameters.
 *
 * `filters` and `orderBy` are represented as JSON strings. Pagination is flat
 * on the wire (`after`/`size` or `page`/`size`) and nested under `pagination`
 * in the decoded request. Extra consumer fields remain flat.
 */
export const queryParamsSchema = <
  Definition extends AnyQueryDefinition,
  Extras extends QueryParamsExtras = Record<never, never>,
>(
  definition: QuerySchemaDefinition<Definition>,
  options: QueryParamsSchemaOptions<Extras> = {}
): Schema.Codec<
  QueryParamsRequest<Definition, Extras>,
  EncodedQueryParams<Extras>
> => {
  const extras = (options.extras ?? {}) as Extras
  assertExtras(extras)

  const request = runtimeQueryRequestSchema(definition)
  const pagination = paginationRequestSchemaFor(definition)
  const paginationFields =
    definition.pagination.kind === 'page'
      ? {
          page: Schema.optional(
            numberFromString(
              (
                pagination as unknown as {
                  readonly fields: { readonly page: Schema.Constraint }
                }
              ).fields.page
            )
          ),
          size: Schema.optional(
            numberFromString(
              (
                pagination as unknown as {
                  readonly fields: { readonly size: Schema.Constraint }
                }
              ).fields.size
            )
          ),
        }
      : {
          after: Schema.optional(Schema.NonEmptyString),
          size: Schema.optional(
            numberFromString(
              (
                pagination as unknown as {
                  readonly fields: { readonly size: Schema.Constraint }
                }
              ).fields.size
            )
          ),
        }

  const encoded = Schema.Struct({
    filters: Schema.optional(Schema.fromJsonString(request.fields.filters)),
    orderBy: Schema.optional(Schema.fromJsonString(request.fields.orderBy)),
    ...paginationFields,
    ...extras,
  })
  const decoded = Schema.Struct({
    filters: Schema.optional(Schema.toType(request.fields.filters)),
    orderBy: Schema.optional(Schema.toType(request.fields.orderBy)),
    pagination: Schema.optional(Schema.toType(request.fields.pagination)),
    ...Object.fromEntries(
      Object.entries(extras).map(([name, schema]) => [
        name,
        Schema.toType(schema),
      ])
    ),
  })

  const encodedRuntime = encoded as unknown as Schema.Codec<
    FlatQuery,
    FlatQuery
  >
  const decodedRuntime = decoded as unknown as Schema.Codec<
    FlatQuery,
    FlatQuery
  >

  return encodedRuntime.pipe(
    Schema.decodeTo(decodedRuntime, {
      decode: SchemaGetter.transform((input) =>
        decodeFlatQuery(input, definition.pagination.kind)
      ),
      encode: SchemaGetter.transform(encodeFlatQuery),
    })
  ) as unknown as Schema.Codec<
    QueryParamsRequest<Definition, Extras>,
    EncodedQueryParams<Extras>
  >
}
