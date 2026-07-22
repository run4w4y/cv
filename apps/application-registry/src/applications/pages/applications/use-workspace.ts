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
import { createParser, useQueryState } from 'nuqs'
import * as React from 'react'
import { useSearchParams } from 'react-router'

import { applicationQueryBoundary } from '../../../table-workspace/query-codecs'
import { useCanonicalQueryFilters } from '../../../table-workspace/query-filters'
import { useDebouncedDraft } from '../../../table-workspace/use-debounced-value'
import type { TableDensity } from '../../components/application-table'
import {
  type ApplicationSavedViewState,
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

const applicationCurrencyParser = createParser({
  parse: parseCompensationDisplayCurrency,
  serialize: (value) => value,
})
  .withDefault('original')
  .withOptions({ history: 'replace', shallow: false, scroll: false })

export const useApplicationsWorkspace = (
  facets: ApplicationFacetsResponse | undefined
) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const parameterState = decodeQueryParameterState(
    applicationQueryBoundary,
    searchParams
  )
  const query: ListApplicationsQuery =
    parameterState.status === 'valid' ? parameterState.value : {}
  const [currency, setCurrency] = useQueryState(
    'currency',
    applicationCurrencyParser
  )
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

  const writeQuery = (next: ListApplicationsQuery) =>
    setSearchParams(
      writeQueryParameterState(applicationQueryBoundary, searchParams, next),
      { replace: true }
    )
  const keyword = query.q ?? ''
  const [keywordDraft, setKeywordDraft] = useDebouncedDraft(
    keyword,
    300,
    (nextKeyword) =>
      writeQuery({
        ...query,
        q: nextKeyword.trim().length === 0 ? undefined : nextKeyword.trim(),
      })
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
      writeQuery({ ...query, filters: nextFilters }),
    onClearInvalidQuery: () => writeQuery({}),
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
    setSearchParams(target, { replace: true })
  }, [filters, initialState, ready, searchParams, setSearchParams])

  // localStorage is the durable boundary for the last visited workspace.
  React.useEffect(() => {
    if (!ready || typeof window === 'undefined') return
    persistApplicationWorkspaceState(window.localStorage, {
      keyword,
      filters: appliedFilters,
      sorting,
      columnVisibility,
      density,
      displayCurrency: currency,
    })
  }, [
    appliedFilters,
    columnVisibility,
    currency,
    density,
    keyword,
    ready,
    sorting,
  ])

  const applyView = (state: ApplicationSavedViewState) => {
    filters.setEditorState(
      queryFiltersStateFromFilterNodes(state.filters) ??
        emptyQueryFiltersState()
    )
    setColumnVisibility(state.columnVisibility)
    setDensity(state.density)
    setSearchParams(writeApplicationViewQueryState(searchParams, state), {
      replace: true,
    })
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
    setCurrency: (nextCurrency: string) => void setCurrency(nextCurrency),
    setDensity,
    setKeyword: (nextKeyword: string) =>
      writeQuery({
        ...query,
        q: nextKeyword.trim().length === 0 ? undefined : nextKeyword.trim(),
      }),
    setKeywordDraft,
    setSorting: (updater: Updater<SortingState>) => {
      const next = functionalUpdate(updater, sorting)
      writeQuery({ ...query, orderBy: applicationOrderByFromSorting(next) })
    },
    sorting,
  }
}
