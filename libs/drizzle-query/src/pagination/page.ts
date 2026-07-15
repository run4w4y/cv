import { invalidPagination, resolveOptions, resolveSize } from './options'
import type {
  PageInfo,
  PagePaginationRequest,
  PaginationImplementation,
  PaginationOptions,
} from './types'

/** Computes a safe zero-based SQL offset from a one-based page number. */
export const pageOffset = (page: number, size: number): number => {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw invalidPagination(
      'Page must be a positive safe integer.',
      'pagination.page'
    )
  }

  if (!Number.isSafeInteger(size) || size < 1) {
    throw invalidPagination(
      'Page size must be a positive safe integer.',
      'pagination.size'
    )
  }

  const offset = (page - 1) * size
  if (!Number.isSafeInteger(offset)) {
    throw invalidPagination(
      'The requested page offset is too large.',
      'pagination.page'
    )
  }

  return offset
}

/**
 * Creates one-based page/size pagination.
 *
 * Queries fetch `size + 1` rows so `hasNextPage` does not require a count.
 * Supplying a total to the finalizer additionally returns `totalItems` and
 * `pageCount`.
 */
export const pagePagination = (
  options: PaginationOptions = {}
): PaginationImplementation<PagePaginationRequest, PageInfo, 'page'> => {
  const resolved = resolveOptions(options)

  return {
    kind: 'page' as const,
    usesCursor: false,
    options: resolved,
    compile: (input: PagePaginationRequest | undefined) => {
      const request = input ?? {}
      const size = resolveSize(request.size, resolved)
      const page = request.page ?? 1
      if (!Number.isSafeInteger(page) || page < 1) {
        throw invalidPagination(
          'Page must be a positive safe integer.',
          'pagination.page'
        )
      }
      const offset = pageOffset(page, size)

      return {
        kind: 'page',
        size,
        limit: size + 1,
        offset,
        finish: <Row>(rows: readonly Row[], totalItems?: number) => {
          if (
            totalItems !== undefined &&
            (!Number.isSafeInteger(totalItems) || totalItems < 0)
          ) {
            throw invalidPagination(
              'The total item count must be a non-negative safe integer.',
              'totalItems'
            )
          }

          const total =
            totalItems === undefined
              ? {}
              : {
                  totalItems,
                  pageCount: Math.ceil(totalItems / size),
                }

          return {
            items: rows.slice(0, size),
            pageInfo: {
              kind: 'page' as const,
              page,
              size,
              hasNextPage: rows.length > size,
              hasPreviousPage: page > 1,
              ...total,
            },
          }
        },
      }
    },
  }
}
