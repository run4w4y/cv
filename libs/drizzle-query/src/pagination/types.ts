import type { CursorScalar } from '../cursor/index'

/** A one-based page request. Omitted values use the factory defaults. */
export type PagePaginationRequest = {
  readonly page?: number
  readonly size?: number
}

/** A forward cursor request. `after` is the opaque token from a prior page. */
export type CursorPaginationRequest = {
  readonly after?: string
  readonly size?: number
}

/** Metadata returned by the built-in page/size pagination strategy. */
export type PageInfo = {
  readonly kind: 'page'
  readonly page: number
  readonly size: number
  readonly hasNextPage: boolean
  readonly hasPreviousPage: boolean
  readonly totalItems?: number
  readonly pageCount?: number
}

/** Metadata returned by the built-in forward cursor pagination strategy. */
export type CursorPageInfo = {
  readonly kind: 'cursor'
  readonly size: number
  readonly hasNextPage: boolean
  readonly hasPreviousPage: boolean
  /** Total items matching the filter, when the caller requested a count. */
  readonly totalItems?: number
  /** Cursor to request the next page, or `null` when this is the final page. */
  readonly nextCursor: string | null
}

/** The minimum page-info shape required from custom pagination strategies. */
export type PaginationPageInfo<Kind extends string = string> = {
  readonly kind: Kind
}

/** A finalized result page. */
export type QueryPage<Row, Info extends PaginationPageInfo> = {
  readonly items: readonly Row[]
  readonly pageInfo: Info
}

/** Package-owned cursor decoder made available to cursor pagination. */
export interface CursorPaginationRuntime {
  readonly decode: (token: string) => readonly CursorScalar[]
}

/** Context supplied while a pagination implementation resolves one request. */
export type PaginationResolveContext = {
  readonly cursor?: CursorPaginationRuntime
}

/**
 * Target-neutral pagination state resolved for one request.
 *
 * `limit` may exceed `size` when the strategy needs a look-ahead row.
 * Cursor values are lowered to SQL later, after a concrete Drizzle table or
 * relational-query alias has been bound.
 */
export interface PaginationResolution<
  Info extends PaginationPageInfo<Kind>,
  Kind extends string = string,
> {
  readonly kind: Kind
  readonly size: number
  readonly limit: number
  readonly offset: number | undefined
  readonly cursorValues?: readonly CursorScalar[]
  readonly finish: <Row>(
    rows: readonly Row[],
    totalItems?: number,
    context?: PaginationFinalizeContext
  ) => QueryPage<Row, Info>
}

/** Target-specific operations supplied only when result rows are finalized. */
export type PaginationFinalizeContext = {
  readonly encodeCursor?: (row: unknown) => string
}

/**
 * The extension seam for pagination.
 *
 * Implementations receive typed request data and package-owned cursor decoding,
 * then return target-neutral bounds and a result finalizer. SQL generation and
 * cursor-value projection remain renderer responsibilities.
 */
export interface PaginationImplementation<
  Request,
  Info extends PaginationPageInfo<Kind>,
  Kind extends string = string,
> {
  /** Stable discriminator propagated to compiled and finalized results. */
  readonly kind: Kind
  /** Requests package-owned cursor ordering and token machinery when true. */
  readonly usesCursor: boolean
  /** Resolved limits exposed by the built-in page and cursor strategies. */
  readonly options?: ResolvedPaginationOptions
  /** Compiles one typed request into target-neutral pagination state. */
  compile(
    request: Request | undefined,
    context: PaginationResolveContext
  ): PaginationResolution<Info, Kind>
}

type AnyPaginationImplementation = PaginationImplementation<
  unknown,
  PaginationPageInfo,
  string
>

/** Extracts the request parameter from a pagination implementation. */
export type PaginationRequestOf<
  Pagination extends AnyPaginationImplementation,
> = Exclude<Parameters<Pagination['compile']>[0], undefined>

/** Extracts the target-neutral result of a pagination implementation. */
export type PaginationResolutionOf<
  Pagination extends AnyPaginationImplementation,
> = ReturnType<Pagination['compile']>

/** Extracts page information from a pagination implementation's finalizer. */
export type PaginationInfoOf<Pagination extends AnyPaginationImplementation> =
  ReturnType<PaginationResolutionOf<Pagination>['finish']>['pageInfo']

/** Extracts the strategy kind returned by a pagination implementation. */
export type PaginationKindOf<Pagination extends AnyPaginationImplementation> =
  PaginationResolutionOf<Pagination>['kind']

/** Shared limits and overflow behavior for the built-in strategies. */
export type PaginationOptions = {
  /** Page size used when a request omits `size`. Defaults to 25. */
  readonly defaultSize?: number
  /** Largest allowed page size. Defaults to 100. */
  readonly maxSize?: number
  /** Whether an oversized request is rejected or capped at `maxSize`. */
  readonly overflow?: 'reject' | 'clamp'
}

export type ResolvedPaginationOptions = {
  readonly defaultSize: number
  readonly maxSize: number
  readonly overflow: 'reject' | 'clamp'
}
