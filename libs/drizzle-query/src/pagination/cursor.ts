import { QueryError } from '../error'
import { invalidPagination, resolveOptions, resolveSize } from './options'
import type {
  CursorPageInfo,
  CursorPaginationRequest,
  PaginationImplementation,
  PaginationOptions,
  PaginationResolveContext,
} from './types'

/**
 * Creates forward, opaque-cursor pagination.
 *
 * The surrounding query definition supplies cursor decoding after it resolves
 * deterministic ordering. Renderers later produce the seek predicate and row
 * encoder for their concrete Drizzle target.
 */
export const cursorPagination = (
  options: PaginationOptions = {}
): PaginationImplementation<
  CursorPaginationRequest,
  CursorPageInfo,
  'cursor'
> => {
  const resolved = resolveOptions(options)

  return {
    kind: 'cursor' as const,
    usesCursor: true,
    options: resolved,
    compile: (
      input: CursorPaginationRequest | undefined,
      context: PaginationResolveContext
    ) => {
      const request = input ?? {}
      const cursor = context.cursor

      if (cursor === undefined) {
        throw new QueryError(
          'invalid-ordering',
          'Cursor pagination requires a unique, non-null final ordering term.',
          { path: 'orderBy' }
        )
      }

      const size = resolveSize(request.size, resolved)
      const after = request.after
      const cursorValues =
        after === undefined ? undefined : cursor.decode(after)

      return {
        kind: 'cursor',
        size,
        limit: size + 1,
        offset: undefined,
        ...(cursorValues === undefined ? {} : { cursorValues }),
        finish: <Row>(
          rows: readonly Row[],
          totalItems: number | undefined,
          finalizeContext: {
            readonly encodeCursor?: (row: unknown) => string
          } = {}
        ) => {
          if (
            totalItems !== undefined &&
            (!Number.isSafeInteger(totalItems) || totalItems < 0)
          ) {
            throw invalidPagination(
              'The total item count must be a non-negative safe integer.',
              'totalItems'
            )
          }

          const items = rows.slice(0, size)
          const last = items.at(-1)
          const encodeCursor = finalizeContext.encodeCursor
          if (last !== undefined && encodeCursor === undefined) {
            throw new QueryError(
              'invalid-ordering',
              'Cursor pagination requires projected ordering values.',
              { path: 'row' }
            )
          }
          const nextCursor =
            last === undefined || encodeCursor === undefined
              ? null
              : encodeCursor(last)
          const hasNextPage = rows.length > size

          return {
            items,
            pageInfo: {
              kind: 'cursor' as const,
              size,
              hasNextPage,
              hasPreviousPage: cursorValues !== undefined,
              ...(totalItems === undefined ? {} : { totalItems }),
              nextCursor: hasNextPage ? nextCursor : null,
            },
          }
        },
      }
    },
  }
}
