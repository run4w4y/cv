import type { SortingState } from '@tanstack/react-table'
import { uniqBy } from 'es-toolkit'

const normalizeSorting = (sorting: SortingState): SortingState =>
  uniqBy(
    sorting.filter(({ id }) => id.length > 0),
    ({ id }) => id
  )

export const parseSorting = (
  value: string,
  sortableFields: ReadonlySet<string>,
  fallback: SortingState
): SortingState => {
  const sorting = normalizeSorting(
    value.split(',').flatMap((term) => {
      const [id, direction, ...extra] = term.trim().split(':')
      if (
        id === undefined ||
        extra.length > 0 ||
        (direction !== 'asc' && direction !== 'desc') ||
        !sortableFields.has(id)
      ) {
        return []
      }
      return [{ id, desc: direction === 'desc' }]
    })
  )

  return sorting.length === 0 ? fallback : sorting
}

export const serializeSorting = (
  sorting: SortingState,
  fallback: SortingState
): string => {
  const normalized = normalizeSorting(sorting)
  return (normalized.length === 0 ? normalizeSorting(fallback) : normalized)
    .map(({ id, desc }) => `${id}:${desc ? 'desc' : 'asc'}`)
    .join(',')
}
