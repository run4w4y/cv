import type { CursorPageInfo, Direction, PageInfo } from '@cv/drizzle-query'
import { Schema } from 'effect'

export { schemaCursorState } from './cursor-state'
export { schemaBinaryFilterOperator } from './operator'
export { type QuerySchemaDefinition, queryRequestSchema } from './query/index'
export {
  type EncodedQueryParams,
  fromSearchParams,
  type QueryParamsExtras,
  type QueryParamsRequest,
  type QueryParamsSchemaOptions,
  type QuerySearchParamsCodec,
  queryParamsCodec,
  queryParamsSchema,
  toSearchParams,
} from './query-params/index'

const positiveInteger = Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0)))
const nonNegativeInteger = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
)

/** Options shared by the built-in pagination request schema factories. */
export interface PaginationSchemaOptions {
  /** Largest accepted page size. Defaults to 100. */
  readonly maximumSize?: number
}

const maximumSize = (options: PaginationSchemaOptions): number => {
  const value = options.maximumSize ?? 100

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError('maximumSize must be a positive safe integer.')
  }

  return value
}

const sizeSchema = (options: PaginationSchemaOptions) =>
  positiveInteger.pipe(
    Schema.check(Schema.isLessThanOrEqualTo(maximumSize(options)))
  )

const numberFromString = <S extends Schema.Constraint>(schema: S) =>
  Schema.NumberFromString.pipe(Schema.decodeTo(schema))

/** A positive page size no larger than 100. */
export const PaginationSizeSchema = sizeSchema({})

/** Creates a decoded page/size pagination request schema. */
export const pagePaginationRequestSchema = (
  options: PaginationSchemaOptions = {}
) =>
  Schema.Struct({
    page: Schema.optional(positiveInteger),
    size: Schema.optional(sizeSchema(options)),
  })

/** Creates a decoded cursor pagination request schema. */
export const cursorPaginationRequestSchema = (
  options: PaginationSchemaOptions = {}
) =>
  Schema.Struct({
    after: Schema.optional(Schema.NonEmptyString),
    size: Schema.optional(sizeSchema(options)),
  })

/** Creates an HTTP-query codec for page/size pagination. */
export const pagePaginationQuerySchema = (
  options: PaginationSchemaOptions = {}
) =>
  Schema.Struct({
    page: Schema.optional(numberFromString(positiveInteger)),
    size: Schema.optional(numberFromString(sizeSchema(options))),
  })

/** Creates an HTTP-query codec for cursor pagination. */
export const cursorPaginationQuerySchema = (
  options: PaginationSchemaOptions = {}
) =>
  Schema.Struct({
    after: Schema.optional(Schema.NonEmptyString),
    size: Schema.optional(numberFromString(sizeSchema(options))),
  })

/** Default decoded page/size pagination request schema. */
export const PagePaginationRequestSchema = pagePaginationRequestSchema()

/** Default decoded cursor pagination request schema. */
export const CursorPaginationRequestSchema = cursorPaginationRequestSchema()

/** Default HTTP-query codec for page/size pagination. */
export const PagePaginationQuerySchema = pagePaginationQuerySchema()

/** Default HTTP-query codec for cursor pagination. */
export const CursorPaginationQuerySchema = cursorPaginationQuerySchema()

/** Direction accepted by an ordering request. */
export const DirectionSchema = Schema.Literals([
  'asc',
  'desc',
]) satisfies Schema.Schema<Direction>

/** Placement of null values accepted by an ordering request. */
export const NullPlacementSchema = Schema.Literals(['first', 'last'])

/** Creates the schema for one ordering term over a consumer-owned field schema. */
export const orderRequestSchema = <FieldSchema extends Schema.Schema<string>>(
  field: FieldSchema
) =>
  Schema.Struct({
    field,
    direction: Schema.optional(DirectionSchema),
    nulls: Schema.optional(NullPlacementSchema),
  })

/** Creates the schema for an ordered sequence of ordering terms. */
export const orderBySchema = <FieldSchema extends Schema.Schema<string>>(
  field: FieldSchema
) => Schema.Array(orderRequestSchema(field))

/** Metadata schema for finalized page/size queries. */
export const PageInfoSchema = Schema.Struct({
  kind: Schema.Literal('page'),
  page: positiveInteger,
  size: positiveInteger,
  hasNextPage: Schema.Boolean,
  hasPreviousPage: Schema.Boolean,
  totalItems: Schema.optional(nonNegativeInteger),
  pageCount: Schema.optional(nonNegativeInteger),
}) satisfies Schema.Schema<PageInfo>

/** Metadata schema for finalized cursor queries. */
export const CursorPageInfoSchema = Schema.Struct({
  kind: Schema.Literal('cursor'),
  size: positiveInteger,
  hasNextPage: Schema.Boolean,
  hasPreviousPage: Schema.Boolean,
  totalItems: Schema.optional(nonNegativeInteger),
  nextCursor: Schema.NullOr(Schema.NonEmptyString),
}) satisfies Schema.Schema<CursorPageInfo>

/** Creates a schema for a finalized query page. */
export const queryPageSchema = <
  Item extends Schema.Constraint,
  Info extends Schema.Constraint,
>(
  item: Item,
  pageInfo: Info
) =>
  Schema.Struct({
    items: Schema.Array(item),
    pageInfo,
  })

/** Creates a finalized page/size response schema for an item schema. */
export const pageQueryPageSchema = <Item extends Schema.Constraint>(
  item: Item
) => queryPageSchema(item, PageInfoSchema)

/** Creates a finalized cursor response schema for an item schema. */
export const cursorQueryPageSchema = <Item extends Schema.Constraint>(
  item: Item
) => queryPageSchema(item, CursorPageInfoSchema)
