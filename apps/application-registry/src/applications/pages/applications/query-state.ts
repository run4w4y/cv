import type { ListApplicationsQuery } from '@cv/application-registry-api-contract'
import { applicationListQuery } from '@cv/application-registry-entity/query'
import {
  orderByFromSortingState,
  writeQueryParameterState,
} from '@cv/drizzle-query-ui/search-params'
import type { SortingState } from '@tanstack/react-table'

import { applicationQueryBoundary } from '../../../table-workspace/query-codecs'
import type { ApplicationSavedViewState } from '../../components/saved-views'

export const defaultApplicationOrderBy = [
  { field: 'updatedRevision', direction: 'asc' },
] as const satisfies NonNullable<ListApplicationsQuery['orderBy']>

const isDefaultApplicationOrderBy = (
  orderBy: NonNullable<ListApplicationsQuery['orderBy']>
): boolean =>
  orderBy.length === defaultApplicationOrderBy.length &&
  orderBy.every(
    (term, index) =>
      term.field === defaultApplicationOrderBy[index]?.field &&
      term.direction === defaultApplicationOrderBy[index]?.direction &&
      term.nulls === undefined
  )

export const applicationOrderByFromSorting = (
  sorting: SortingState
): ListApplicationsQuery['orderBy'] => {
  const orderBy = orderByFromSortingState(sorting, applicationListQuery)
  return orderBy === undefined || isDefaultApplicationOrderBy(orderBy)
    ? undefined
    : orderBy
}

export const writeApplicationViewQueryState = (
  searchParams: URLSearchParams,
  state: ApplicationSavedViewState
): URLSearchParams => {
  const orderBy = applicationOrderByFromSorting(state.sorting)
  const query: ListApplicationsQuery = {
    ...(state.filters.length === 0 ? {} : { filters: state.filters }),
    ...(orderBy === undefined ? {} : { orderBy }),
    ...(state.keyword.length === 0 ? {} : { q: state.keyword }),
  }
  const next = writeQueryParameterState(
    applicationQueryBoundary,
    searchParams,
    query
  )

  if (state.displayCurrency === 'original') next.delete('currency')
  else next.set('currency', state.displayCurrency)
  return next
}
