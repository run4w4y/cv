import type {
  ApplicationFacetsResponse,
  ListApplicationsQuery,
} from '@cv/application-registry-api-contract'
import { applicationListQuery } from '@cv/application-registry-entity/query'
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

import { applicationQueryBoundary } from '../../../table-workspace/query-codecs'
import { useCanonicalQueryFilters } from '../../../table-workspace/query-filters'
import { useDebouncedDraft } from '../../../table-workspace/use-debounced-value'
import type { TableDensity } from '../../components/application-table'
import {
  type ApplicationSavedViewState,
  comparableApplicationViewState,
  loadApplicationWorkspaceState,
  persistApplicationWorkspaceState,
} from '../../components/saved-views'
import { parseCompensationDisplayCurrency } from '../../model/currency'
import { createApplicationFilterFieldPresentation } from '../../model/filter-fields'
import {
  applicationOrderByFromSorting,
  defaultApplicationOrderBy,
  writeApplicationViewQueryState,
} from './query-state'

export const useApplicationsWorkspace = (
  facets: ApplicationFacetsResponse | undefined
) => {
  const [searchParams, setSearchParams] = useSearchParams()
  // Router updates can arrive before this hook rerenders. Keep one advancing
  // snapshot so consecutive controls merge instead of overwriting each other.
  const pendingSearchParams = React.useRef(searchParams)
  if (pendingSearchParams.current.toString() !== searchParams.toString()) {
    pendingSearchParams.current = searchParams
  }
  const updateSearchParams = React.useCallback(
    (update: (current: URLSearchParams) => URLSearchParams) => {
      const next = update(new URLSearchParams(pendingSearchParams.current))
      pendingSearchParams.current = next
      setSearchParams(next, { replace: true })
    },
    [setSearchParams]
  )
  const parameterState = decodeQueryParameterState(
    applicationQueryBoundary,
    searchParams
  )
  const query: ListApplicationsQuery =
    parameterState.status === 'valid' ? parameterState.value : {}
  const currency =
    parseCompensationDisplayCurrency(searchParams.get('currency')) ?? 'original'
  const [initialState] = React.useState<ApplicationSavedViewState | null>(() =>
    typeof window === 'undefined'
      ? null
      : loadApplicationWorkspaceState(window.localStorage)
  )
  const [urlInitiallyConfigured] = React.useState(() =>
    ['currency', 'filter', 'q', 'sort'].some((key) => searchParams.has(key))
  )
  const [density, setDensity] = React.useState<TableDensity>(
    initialState?.density ?? 'comfortable'
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialState?.columnVisibility ?? {})
  const [ready, setReady] = React.useState(
    urlInitiallyConfigured || initialState === null
  )

  const writeQuery = React.useCallback(
    (update: (current: ListApplicationsQuery) => ListApplicationsQuery): void =>
      updateSearchParams((currentSearchParams) => {
        const currentParameterState = decodeQueryParameterState(
          applicationQueryBoundary,
          currentSearchParams
        )
        const currentQuery =
          currentParameterState.status === 'valid'
            ? currentParameterState.value
            : {}
        return writeQueryParameterState(
          applicationQueryBoundary,
          currentSearchParams,
          update(currentQuery)
        )
      }),
    [updateSearchParams]
  )
  const keyword = query.q ?? ''
  const [keywordDraft, setKeywordDraft] = useDebouncedDraft(
    keyword,
    300,
    (nextKeyword) =>
      writeQuery((current) => ({
        ...current,
        q: nextKeyword.trim().length === 0 ? undefined : nextKeyword.trim(),
      }))
  )
  const fieldPresentation = createApplicationFilterFieldPresentation(facets)
  const appliedFilters = query.filters ?? []
  const filters = useCanonicalQueryFilters({
    searchParams,
    appliedFilters,
    blocksRequest: parameterState.status === 'invalid',
    definition: applicationListQuery,
    presentation: fieldPresentation,
    onFiltersChange: (nextFilters) =>
      writeQuery((current) => ({ ...current, filters: nextFilters })),
    onClearInvalidQuery: () => writeQuery(() => ({})),
  })
  const effectiveOrderBy = query.orderBy ?? defaultApplicationOrderBy
  const sorting: SortingState = sortingStateFromOrderBy(effectiveOrderBy).map(
    (entry) => ({ ...entry })
  )
  const appliedQuery: Omit<ListApplicationsQuery, 'pagination'> = {
    ...(appliedFilters.length === 0 ? {} : { filters: appliedFilters }),
    ...(query.orderBy === undefined ? {} : { orderBy: query.orderBy }),
    ...(keyword.length === 0 ? {} : { q: keyword }),
  }
  const currentState: ApplicationSavedViewState = {
    keyword,
    filters: appliedFilters,
    sorting,
    columnVisibility,
    density,
    displayCurrency: currency,
  }
  const persistedWorkspaceState = comparableApplicationViewState(currentState)

  // Restore browser-facing workspace state once on entry.
  React.useEffect(() => {
    if (ready || initialState === null) return
    const target = writeApplicationViewQueryState(searchParams, initialState)
    if (target.toString() === searchParams.toString()) {
      filters.setEditorState(
        queryFiltersStateFromFilterNodes(initialState.filters) ??
          emptyQueryFiltersState()
      )
      setReady(true)
      return
    }
    updateSearchParams(() => target)
  }, [filters, initialState, ready, searchParams, updateSearchParams])

  // localStorage is the durable boundary for the last visited workspace.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the canonical state fingerprint covers every persisted field.
  React.useEffect(() => {
    if (!ready || typeof window === 'undefined') return
    persistApplicationWorkspaceState(window.localStorage, currentState)
  }, [persistedWorkspaceState, ready])

  const applyView = (state: ApplicationSavedViewState) => {
    filters.setEditorState(
      queryFiltersStateFromFilterNodes(state.filters) ??
        emptyQueryFiltersState()
    )
    setColumnVisibility(state.columnVisibility)
    setDensity(state.density)
    updateSearchParams((current) =>
      writeApplicationViewQueryState(current, state)
    )
  }

  return {
    applyView,
    appliedQuery,
    columnVisibility,
    currentState,
    density,
    fieldPresentation,
    filters,
    keywordDraft,
    queryParameterState: parameterState,
    queryState: { currency, keyword },
    ready,
    setColumnVisibility: (updater: Updater<VisibilityState>) =>
      setColumnVisibility((current) => functionalUpdate(updater, current)),
    setCurrency: (nextCurrency: string) => {
      const parsedCurrency = parseCompensationDisplayCurrency(nextCurrency)
      if (parsedCurrency === null) return
      updateSearchParams((current) => {
        if (parsedCurrency === 'original') {
          current.delete('currency')
        } else {
          current.set('currency', parsedCurrency)
        }
        return current
      })
    },
    setDensity,
    setKeyword: (nextKeyword: string) =>
      writeQuery((current) => ({
        ...current,
        q: nextKeyword.trim().length === 0 ? undefined : nextKeyword.trim(),
      })),
    setKeywordDraft,
    setSorting: (updater: Updater<SortingState>) => {
      const next = functionalUpdate(updater, sorting)
      writeQuery((current) => ({
        ...current,
        orderBy: applicationOrderByFromSorting(next),
      }))
    },
    sorting,
  }
}
