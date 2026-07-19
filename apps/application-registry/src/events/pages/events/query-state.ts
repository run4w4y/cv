import { activityListQuery } from '@cv/application-registry-entity/query'
import {
  serializeQueryFilterNodes,
  writeCanonicalQueryFiltersUrlState,
} from '@cv/drizzle-query-ui'
import type { SortingState } from '@tanstack/react-table'

import {
  parseSorting as parseRegistrySorting,
  serializeSorting as serializeRegistrySorting,
} from '../../../lib/sorting'
import type { EventsSavedViewState } from '../../components/saved-views'

export const defaultEventSorting: SortingState = [
  { id: 'revision', desc: true },
]

const sortableFields = new Set(
  activityListQuery.fields
    .filter((field) => field.sortable)
    .map((field) => field.name)
)

export const parseEventSorting = (value: string): SortingState =>
  parseRegistrySorting(value, sortableFields, defaultEventSorting)

export const serializeEventSorting = (sorting: SortingState): string =>
  serializeRegistrySorting(sorting, defaultEventSorting)

export const writeEventsViewQueryState = (
  searchParams: URLSearchParams,
  state: EventsSavedViewState
): URLSearchParams => {
  const next = writeCanonicalQueryFiltersUrlState(
    searchParams,
    serializeQueryFilterNodes(state.filters)
  )
  const sort = serializeEventSorting(state.sorting)
  if (sort === serializeEventSorting(defaultEventSorting)) next.delete('sort')
  else next.set('sort', sort)
  return next
}
