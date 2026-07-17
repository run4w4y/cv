import type { ApplicationFacetsResponse } from '@cv/application-registry-api-contract'
import { applicationListQuery } from '@cv/application-registry-entity/query'
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
import { createParser, parseAsString, useQueryStates } from 'nuqs'
import * as React from 'react'
import { useSearchParams } from 'react-router'

import type { TableDensity } from '../../components/application-table'
import {
  type ApplicationSavedViewState,
  loadApplicationWorkspaceState,
  persistApplicationWorkspaceState,
} from '../../components/saved-views'
import { parseCompensationDisplayCurrency } from '../../model/currency'
import { createApplicationFilterFieldPresentation } from '../../model/filter-fields'
import {
  canonicalFiltersParser,
  useCanonicalQueryFilters,
} from '../../../table-workspace/query-filters'
import { useDebouncedDraft } from '../../../table-workspace/use-debounced-value'
import {
  defaultApplicationSorting,
  parseApplicationSorting,
  serializeApplicationSorting,
  writeApplicationViewQueryState,
} from './query-state'

const applicationCurrencyParser = createParser({
  parse: parseCompensationDisplayCurrency,
  serialize: (value) => value,
}).withDefault('original')

export const useApplicationsWorkspace = (
  facets: ApplicationFacetsResponse | undefined
) => {
  const [isNavigating, startQueryTransition] = React.useTransition()
  const [searchParams, setSearchParams] = useSearchParams()
  const [initialState] = React.useState<ApplicationSavedViewState | null>(() =>
    typeof window === 'undefined'
      ? null
      : loadApplicationWorkspaceState(window.localStorage)
  )
  const [urlInitiallyConfigured] = React.useState(() =>
    ['currency', 'filters', 'q', 'sort'].some((key) => searchParams.has(key))
  )
  const [queryState, setQueryState] = useQueryStates(
    {
      keyword: parseAsString.withDefault(''),
      filters: canonicalFiltersParser,
      sort: parseAsString.withDefault(
        serializeApplicationSorting(defaultApplicationSorting)
      ),
      currency: applicationCurrencyParser,
    },
    {
      history: 'replace',
      shallow: false,
      scroll: false,
      startTransition: startQueryTransition,
      urlKeys: {
        keyword: 'q',
        filters: 'filters',
        sort: 'sort',
        currency: 'currency',
      },
    }
  )
  const [density, setDensity] = React.useState<TableDensity>(
    initialState?.density ?? 'comfortable'
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialState?.columnVisibility ?? {})
  const [ready, setReady] = React.useState(
    urlInitiallyConfigured || initialState === null
  )
  const [keywordDraft, setKeywordDraft] = useDebouncedDraft(
    queryState.keyword,
    300,
    (keyword) => void setQueryState({ keyword })
  )
  const fieldPresentation = createApplicationFilterFieldPresentation(facets)
  const filters = useCanonicalQueryFilters({
    searchParams,
    setSearchParams,
    definition: applicationListQuery,
    presentation: fieldPresentation,
    applyState: (state) => void setQueryState({ filters: state }),
  })
  const sorting = parseApplicationSorting(queryState.sort)
  const currentState: ApplicationSavedViewState = {
    keyword: queryState.keyword,
    filters: filters.queryFilters,
    sorting,
    columnVisibility,
    density,
    displayCurrency: queryState.currency,
  }

  // Restore browser-facing workspace state once on entry.
  React.useEffect(() => {
    if (ready || initialState === null) return
    filters.markNavigation(serializeQueryFilterNodes(initialState.filters))
    filters.setEditorState(
      queryFiltersStateFromFilterNodes(initialState.filters) ??
        emptyQueryFiltersState()
    )
    setSearchParams(
      writeApplicationViewQueryState(searchParams, initialState),
      {
        replace: true,
      }
    )
    setReady(true)
  }, [filters, initialState, ready, searchParams, setSearchParams])

  // localStorage is the durable boundary for the last visited workspace.
  React.useEffect(() => {
    if (!ready || typeof window === 'undefined') return
    persistApplicationWorkspaceState(window.localStorage, {
      keyword: queryState.keyword,
      filters: filters.queryFilters,
      sorting: parseApplicationSorting(queryState.sort),
      columnVisibility,
      density,
      displayCurrency: queryState.currency,
    })
  }, [
    columnVisibility,
    density,
    filters.queryFilters,
    queryState.currency,
    queryState.keyword,
    queryState.sort,
    ready,
  ])

  const applyView = (state: ApplicationSavedViewState) => {
    filters.markNavigation(serializeQueryFilterNodes(state.filters))
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
    columnVisibility,
    currentState,
    density,
    fieldPresentation,
    filters,
    isNavigating,
    keywordDraft,
    queryState,
    ready,
    setColumnVisibility: (updater: Updater<VisibilityState>) =>
      setColumnVisibility((current) => functionalUpdate(updater, current)),
    setCurrency: (currency: string) => void setQueryState({ currency }),
    setDensity,
    setKeyword: (keyword: string) => void setQueryState({ keyword }),
    setKeywordDraft,
    setSorting: (updater: Updater<SortingState>) => {
      const next = functionalUpdate(updater, sorting)
      void setQueryState({ sort: serializeApplicationSorting(next) })
    },
    sorting,
  }
}
