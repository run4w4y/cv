import type { ListActivitiesQuery } from '@cv/application-registry-api-contract'
import { activityListQuery } from '@cv/application-registry-entity/query'
import {
  orderByFromSortingState,
  writeQueryParameterState,
} from '@cv/drizzle-query-ui/search-params'
import type { SortingState } from '@tanstack/react-table'

import { activityQueryBoundary } from '../../../table-workspace/query-codecs'
import type { EventsSavedViewState } from '../../components/saved-views'

export const defaultEventOrderBy = [
  { field: 'revision', direction: 'asc' },
] as const satisfies NonNullable<ListActivitiesQuery['orderBy']>

const isDefaultEventOrderBy = (
  orderBy: NonNullable<ListActivitiesQuery['orderBy']>
): boolean =>
  orderBy.length === defaultEventOrderBy.length &&
  orderBy.every(
    (term, index) =>
      term.field === defaultEventOrderBy[index]?.field &&
      term.direction === defaultEventOrderBy[index]?.direction &&
      term.nulls === undefined
  )

export const eventOrderByFromSorting = (
  sorting: SortingState
): ListActivitiesQuery['orderBy'] => {
  const orderBy = orderByFromSortingState(sorting, activityListQuery)
  return orderBy === undefined || isDefaultEventOrderBy(orderBy)
    ? undefined
    : orderBy
}

export const writeEventsViewQueryState = (
  searchParams: URLSearchParams,
  state: EventsSavedViewState
): URLSearchParams => {
  const orderBy = eventOrderByFromSorting(state.sorting)
  return writeQueryParameterState(activityQueryBoundary, searchParams, {
    ...(state.filters.length === 0 ? {} : { filters: state.filters }),
    ...(orderBy === undefined ? {} : { orderBy }),
  })
}
