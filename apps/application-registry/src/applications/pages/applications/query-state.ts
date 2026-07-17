import { applicationListQuery } from '@cv/application-registry-entity/query'
import {
  serializeQueryFilterNodes,
  writeCanonicalQueryFiltersUrlState,
} from '@cv/drizzle-query-ui'
import type { SortingState } from '@tanstack/react-table'

import {
  parseSorting as parseRegistrySorting,
  serializeSorting as serializeRegistrySorting,
} from '../../../lib/sorting'
import type { ApplicationSavedViewState } from '../../components/saved-views'

export const defaultApplicationSorting: SortingState = [
  { id: 'updatedRevision', desc: true },
]

const sortableFields = new Set(
  applicationListQuery.fields
    .filter((field) => field.sortable)
    .map((field) => field.name)
)

export const parseApplicationSorting = (value: string): SortingState =>
  parseRegistrySorting(value, sortableFields, defaultApplicationSorting)

export const serializeApplicationSorting = (sorting: SortingState): string =>
  serializeRegistrySorting(sorting, defaultApplicationSorting)

export const writeApplicationViewQueryState = (
  searchParams: URLSearchParams,
  state: ApplicationSavedViewState
): URLSearchParams => {
  const next = writeCanonicalQueryFiltersUrlState(
    searchParams,
    serializeQueryFilterNodes(state.filters)
  )
  if (state.keyword.length === 0) next.delete('q')
  else next.set('q', state.keyword)

  const sort = serializeApplicationSorting(state.sorting)
  if (sort === serializeApplicationSorting(defaultApplicationSorting)) {
    next.delete('sort')
  } else {
    next.set('sort', sort)
  }

  if (state.displayCurrency === 'original') next.delete('currency')
  else next.set('currency', state.displayCurrency)
  return next
}
