import type { FilterNode, OrderRequest } from '@cv/drizzle-query'

type QueryRequest = {
  readonly filters?: readonly FilterNode[]
  readonly orderBy?: readonly OrderRequest[]
}

/** Synchronous browser facade over one schema-composed query codec. */
export type QuerySearchParamsBoundary<Request extends QueryRequest> = {
  readonly decode: (input: URLSearchParams | string) => Request
  readonly encode: (request: Request) => URLSearchParams
  readonly ownedKeys: ReadonlySet<string>
}

export type QueryParameterState<Request> =
  | { readonly status: 'valid'; readonly value: Request }
  | {
      readonly status: 'invalid'
      readonly raw: string
      readonly issues: readonly [string, ...string[]]
    }

const replaceOwnedQueryParams = (
  input: URLSearchParams,
  encoded: URLSearchParams,
  ownedKeys: ReadonlySet<string>
): URLSearchParams => {
  const next = new URLSearchParams(input)
  for (const name of ownedKeys) next.delete(name)
  for (const [name, value] of encoded) next.append(name, value)
  return next
}

/** Encodes one typed request while preserving unrelated URL parameters. */
export const writeQueryParameterState = <Request extends QueryRequest>(
  boundary: QuerySearchParamsBoundary<Request>,
  input: URLSearchParams,
  request: Request
): URLSearchParams =>
  replaceOwnedQueryParams(input, boundary.encode(request), boundary.ownedKeys)

const issueMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** Decodes the complete query contract without normalizing browser state. */
export const decodeQueryParameterState = <Request extends QueryRequest>(
  boundary: QuerySearchParamsBoundary<Request>,
  input: URLSearchParams
): QueryParameterState<Request> => {
  try {
    return { status: 'valid', value: boundary.decode(input) }
  } catch (error) {
    const owned = [...input.entries()].filter(([name]) =>
      boundary.ownedKeys.has(name)
    )
    return {
      status: 'invalid',
      raw: owned.map(([name, value]) => `${name}=${value}`).join('&'),
      issues: [issueMessage(error)],
    }
  }
}

/** Minimal table sorting shape shared without taking a TanStack dependency. */
export type QueryTableSortingState = readonly {
  readonly id: string
  readonly desc: boolean
}[]

export const sortingStateFromOrderBy = (
  orderBy: readonly OrderRequest[]
): QueryTableSortingState =>
  orderBy.map((term) => ({
    id: term.field,
    desc: term.direction === 'desc',
  }))

/** Validates table sorting identifiers against definition metadata. */
export const orderByFromSortingState = (
  sorting: QueryTableSortingState,
  definition: {
    readonly fields: readonly {
      readonly name: string
      readonly sortable: boolean
    }[]
  }
): readonly OrderRequest[] | undefined => {
  const sortable = new Set(
    definition.fields
      .filter((field) => field.sortable)
      .map((field) => field.name)
  )
  const seen = new Set<string>()
  const orderBy: OrderRequest[] = []
  for (const entry of sorting) {
    if (!sortable.has(entry.id) || seen.has(entry.id)) return undefined
    seen.add(entry.id)
    orderBy.push({
      field: entry.id,
      direction: entry.desc ? 'desc' : 'asc',
    })
  }
  return orderBy
}
