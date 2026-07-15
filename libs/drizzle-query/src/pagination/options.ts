import { QueryError } from '../error'
import type { PaginationOptions, ResolvedPaginationOptions } from './types'

export const invalidPagination = (message: string, path?: string): QueryError =>
  new QueryError('invalid-pagination', message, {
    ...(path === undefined ? {} : { path }),
  })

export const resolveOptions = (
  options: PaginationOptions
): ResolvedPaginationOptions => {
  const resolved: ResolvedPaginationOptions = {
    defaultSize: options.defaultSize ?? 25,
    maxSize: options.maxSize ?? 100,
    overflow: options.overflow ?? 'reject',
  }

  if (
    !Number.isSafeInteger(resolved.defaultSize) ||
    resolved.defaultSize < 1 ||
    !Number.isSafeInteger(resolved.maxSize) ||
    resolved.maxSize < 1 ||
    resolved.maxSize >= Number.MAX_SAFE_INTEGER ||
    resolved.defaultSize > resolved.maxSize
  ) {
    throw new QueryError(
      'invalid-definition',
      'The pagination defaults are invalid.',
      { path: 'pagination' }
    )
  }

  return resolved
}

export const resolveSize = (
  value: number | undefined,
  options: ResolvedPaginationOptions
): number => {
  const requested = value ?? options.defaultSize

  if (!Number.isSafeInteger(requested) || requested < 1) {
    throw invalidPagination(
      'Page size must be a positive safe integer.',
      'pagination.size'
    )
  }

  if (requested <= options.maxSize) {
    return requested
  }

  if (options.overflow === 'clamp') {
    return options.maxSize
  }

  throw invalidPagination(
    `Page size must not exceed ${options.maxSize}.`,
    'pagination.size'
  )
}
