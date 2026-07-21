import {
  type AnyQueryDefinition,
  decodeFlatQueryParams,
  encodeFlatQueryParams,
  type FlatQueryParams,
  formatFilterExpression,
  formatSortExpression,
  normalizeQueryFilterNodes,
  parseFilterExpression,
  parseSortExpression,
  reservedQueryParameters,
} from '@cv/drizzle-query'
import { Effect, Option, Schema, SchemaGetter, SchemaIssue } from 'effect'

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

const assertExtras = (extras: QueryParamsExtras): void => {
  for (const name of Object.keys(extras)) {
    if (reservedQueryParameters.has(name)) {
      throw new TypeError(`The query parameter "${name}" is reserved.`)
    }
  }
}

const numberFromString = <S extends Schema.Constraint>(schema: S) =>
  Schema.NumberFromString.pipe(Schema.decodeTo(schema))

type RuntimeSchema = Schema.Constraint

const queryLanguageSchemaIssue = (
  actual: unknown,
  messages: readonly string[]
) =>
  new SchemaIssue.InvalidValue(Option.some(actual), {
    message: messages.join(' '),
  })

const compactFiltersSchema = (filters: RuntimeSchema): RuntimeSchema =>
  Schema.String.pipe(
    Schema.decodeTo(filters, {
      decode: SchemaGetter.transformOrFail((input) => {
        const parsed = parseFilterExpression(input)
        return parsed.ok
          ? Effect.succeed(parsed.value)
          : Effect.fail(
              queryLanguageSchemaIssue(
                input,
                parsed.issues.map((issue) => issue.message)
              )
            )
      }),
      encode: SchemaGetter.transformOrFail((input) => {
        const nodes = normalizeQueryFilterNodes(input)
        if (nodes === undefined) {
          return Effect.fail(
            queryLanguageSchemaIssue(input, [
              'Expected a structurally valid filter tree.',
            ])
          )
        }
        const formatted = formatFilterExpression(nodes)
        return formatted.ok && formatted.value !== undefined
          ? Effect.succeed(formatted.value)
          : Effect.fail(
              queryLanguageSchemaIssue(
                input,
                formatted.ok
                  ? ['Empty filters must be omitted from the request.']
                  : formatted.issues.map((issue) => issue.message)
              )
            )
      }),
    })
  )

const compactOrderBySchema = (orderBy: RuntimeSchema): RuntimeSchema =>
  Schema.String.pipe(
    Schema.decodeTo(orderBy, {
      decode: SchemaGetter.transformOrFail((input) => {
        const parsed = parseSortExpression(input)
        return parsed.ok
          ? Effect.succeed(parsed.value)
          : Effect.fail(
              queryLanguageSchemaIssue(
                input,
                parsed.issues.map((issue) => issue.message)
              )
            )
      }),
      encode: SchemaGetter.transformOrFail((input) => {
        if (!Array.isArray(input)) {
          return Effect.fail(
            queryLanguageSchemaIssue(input, [
              'Expected an array of ordering terms.',
            ])
          )
        }
        const formatted = formatSortExpression(input)
        return formatted.ok && formatted.value !== undefined
          ? Effect.succeed(formatted.value)
          : Effect.fail(
              queryLanguageSchemaIssue(
                input,
                formatted.ok
                  ? ['Empty ordering must be omitted from the request.']
                  : formatted.issues.map((issue) => issue.message)
              )
            )
      }),
    })
  )

/**
 * Derives a bidirectional Effect Schema for HTTP query parameters.
 *
 * Filters and ordering use compact `filter` and `sort` values. Pagination is
 * flat on the wire (`after`/`size` or `page`/`size`) and nested under
 * `pagination` in the decoded request. Extra consumer fields remain flat.
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
    filter: Schema.optional(compactFiltersSchema(request.fields.filters)),
    sort: Schema.optional(compactOrderBySchema(request.fields.orderBy)),
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
    FlatQueryParams,
    FlatQueryParams
  >
  const decodedRuntime = decoded as unknown as Schema.Codec<
    FlatQueryParams,
    FlatQueryParams
  >

  return encodedRuntime.pipe(
    Schema.decodeTo(decodedRuntime, {
      decode: SchemaGetter.transform((input) => {
        const { filter, sort, ...remaining } = input as FlatQueryParams
        return decodeFlatQueryParams(
          {
            ...remaining,
            ...(filter === undefined ? {} : { filters: filter }),
            ...(sort === undefined ? {} : { orderBy: sort }),
          },
          definition.pagination.kind === 'page' ? 'page' : 'cursor'
        )
      }),
      encode: SchemaGetter.transform((input) => {
        const flat = encodeFlatQueryParams(input)
        const { filters, orderBy, ...remaining } = flat
        const normalizedFilters =
          Array.isArray(filters) && filters.length === 0 ? undefined : filters
        const normalizedOrderBy =
          Array.isArray(orderBy) && orderBy.length === 0 ? undefined : orderBy
        return {
          ...remaining,
          ...(normalizedFilters === undefined
            ? {}
            : { filter: normalizedFilters }),
          ...(normalizedOrderBy === undefined
            ? {}
            : { sort: normalizedOrderBy }),
        }
      }),
    })
  ) as unknown as Schema.Codec<
    QueryParamsRequest<Definition, Extras>,
    EncodedQueryParams<Extras>
  >
}
