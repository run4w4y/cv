export type QueryPaginationKind = 'cursor' | 'page'

export const reservedQueryParameters: ReadonlySet<string> = new Set([
  'filter',
  'sort',
  'pagination',
  'after',
  'page',
  'size',
])

export type FlatQueryParams = Readonly<Record<string, unknown>>

/** Moves flat wire pagination fields into the decoded request shape. */
export const decodeFlatQueryParams = (
  input: FlatQueryParams,
  paginationKind: QueryPaginationKind
): FlatQueryParams => {
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

/** Flattens decoded pagination for the HTTP query-string representation. */
export const encodeFlatQueryParams = (
  input: FlatQueryParams
): FlatQueryParams => {
  const { pagination, ...query } = input
  return typeof pagination === 'object' && pagination !== null
    ? { ...query, ...pagination }
    : query
}
