import { eventListQuery } from '@cv/application-registry-entity/query'
import {
  emptyQueryFiltersState,
  queryFiltersStateFromFilterNodes,
  serializeQueryFilterNodes,
} from '@cv/drizzle-query-ui'
import {
  functionalUpdate,
  type SortingState,
  type Updater,
  type VisibilityState,
} from '@tanstack/react-table'
import { parseAsString, useQueryStates } from 'nuqs'
import * as React from 'react'
import { useSearchParams } from 'react-router'
import {
  canonicalFiltersParser,
  useCanonicalQueryFilters,
} from '../../../table-workspace/query-filters'
import type {
  EventsSavedViewState,
  EventsTableDensity,
} from '../../components/saved-views'
import { eventFilterFieldPresentation } from '../../model/filter-fields'
import {
  defaultEventSorting,
  parseEventSorting,
  serializeEventSorting,
  writeEventsViewQueryState,
} from './query-state'

export const useEventsWorkspace = () => {
  const [isNavigating, startQueryTransition] = React.useTransition()
  const [searchParams, setSearchParams] = useSearchParams()
  const [queryState, setQueryState] = useQueryStates(
    {
      filters: canonicalFiltersParser,
      sort: parseAsString.withDefault(
        serializeEventSorting(defaultEventSorting)
      ),
    },
    {
      history: 'replace',
      shallow: false,
      scroll: false,
      startTransition: startQueryTransition,
      urlKeys: { filters: 'filters', sort: 'sort' },
    }
  )
  const [density, setDensity] =
    React.useState<EventsTableDensity>('comfortable')
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const filters = useCanonicalQueryFilters({
    searchParams,
    setSearchParams,
    definition: eventListQuery,
    presentation: eventFilterFieldPresentation,
    applyState: (state) => void setQueryState({ filters: state }),
  })
  const sorting = parseEventSorting(queryState.sort)
  const currentState: EventsSavedViewState = {
    filters: filters.queryFilters,
    sorting,
    columnVisibility,
    density,
  }

  const applyView = (state: EventsSavedViewState) => {
    const nextFilters = queryFiltersStateFromFilterNodes(state.filters)
    filters.markNavigation(serializeQueryFilterNodes(state.filters))
    filters.setEditorState(nextFilters ?? emptyQueryFiltersState())
    setColumnVisibility(state.columnVisibility)
    setDensity(state.density)
    setSearchParams(writeEventsViewQueryState(searchParams, state), {
      replace: true,
    })
  }

  return {
    applyView,
    columnVisibility,
    currentState,
    density,
    filters,
    isNavigating,
    setColumnVisibility: (updater: Updater<VisibilityState>) =>
      setColumnVisibility((current) => functionalUpdate(updater, current)),
    setDensity,
    setSorting: (updater: Updater<SortingState>) => {
      const next = functionalUpdate(updater, sorting)
      void setQueryState({ sort: serializeEventSorting(next) })
    },
    sorting,
  }
}
