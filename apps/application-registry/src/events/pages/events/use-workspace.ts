import type { ListActivitiesQuery } from '@cv/application-registry-api-contract'
import { activityListQuery } from '@cv/application-registry-entity/query'
import {
  emptyQueryFiltersState,
  queryFiltersStateFromFilterNodes,
} from '@cv/drizzle-query-ui'
import {
  decodeQueryParameterState,
  sortingStateFromOrderBy,
  writeQueryParameterState,
} from '@cv/drizzle-query-ui/search-params'
import {
  functionalUpdate,
  type SortingState,
  type Updater,
  type VisibilityState,
} from '@tanstack/react-table'
import * as React from 'react'
import { useSearchParams } from 'react-router'

import { activityQueryBoundary } from '../../../table-workspace/query-codecs'
import { useCanonicalQueryFilters } from '../../../table-workspace/query-filters'
import type {
  EventsSavedViewState,
  EventsTableDensity,
} from '../../components/saved-views'
import { eventFilterFieldPresentation } from '../../model/filter-fields'
import {
  defaultEventOrderBy,
  eventOrderByFromSorting,
  writeEventsViewQueryState,
} from './query-state'

export const useEventsWorkspace = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const parameterState = decodeQueryParameterState(
    activityQueryBoundary,
    searchParams
  )
  const query: ListActivitiesQuery =
    parameterState.status === 'valid' ? parameterState.value : {}
  const [density, setDensity] =
    React.useState<EventsTableDensity>('comfortable')
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})

  const writeQuery = (next: ListActivitiesQuery) =>
    setSearchParams(
      writeQueryParameterState(activityQueryBoundary, searchParams, next),
      { replace: true }
    )
  const appliedFilters = query.filters ?? []
  const filters = useCanonicalQueryFilters({
    searchParams,
    appliedFilters,
    blocksRequest: parameterState.status === 'invalid',
    definition: activityListQuery,
    presentation: eventFilterFieldPresentation,
    onFiltersChange: (nextFilters) =>
      writeQuery({ ...query, filters: nextFilters }),
    onClearInvalidQuery: () => writeQuery({}),
  })
  const effectiveOrderBy = query.orderBy ?? defaultEventOrderBy
  const sorting: SortingState = sortingStateFromOrderBy(effectiveOrderBy).map(
    (entry) => ({ ...entry })
  )
  const appliedQuery: Omit<ListActivitiesQuery, 'pagination'> = {
    ...(appliedFilters.length === 0 ? {} : { filters: appliedFilters }),
    ...(query.orderBy === undefined ? {} : { orderBy: query.orderBy }),
  }
  const currentState: EventsSavedViewState = {
    filters: appliedFilters,
    sorting,
    columnVisibility,
    density,
  }

  const applyView = (state: EventsSavedViewState) => {
    filters.setEditorState(
      queryFiltersStateFromFilterNodes(state.filters) ??
        emptyQueryFiltersState()
    )
    setColumnVisibility(state.columnVisibility)
    setDensity(state.density)
    setSearchParams(writeEventsViewQueryState(searchParams, state), {
      replace: true,
    })
  }

  return {
    applyView,
    appliedQuery,
    columnVisibility,
    currentState,
    density,
    filters,
    queryParameterState: parameterState,
    setColumnVisibility: (updater: Updater<VisibilityState>) =>
      setColumnVisibility((current) => functionalUpdate(updater, current)),
    setDensity,
    setSorting: (updater: Updater<SortingState>) => {
      const next = functionalUpdate(updater, sorting)
      writeQuery({ ...query, orderBy: eventOrderByFromSorting(next) })
    },
    sorting,
  }
}
