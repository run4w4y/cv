import { decodeListApplicationsSearchParams } from '@cv/application-registry-api-contract'
import { applicationListQuery } from '@cv/application-registry-entity/query'
import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as React from 'react'

import {
  applicationsAtom,
  type ApplicationsListRequest,
  refreshApplicationLists,
} from '../../data'
import type { useApplicationsWorkspace } from './use-workspace'

type ApplicationsWorkspace = ReturnType<typeof useApplicationsWorkspace>

export const useApplicationsList = (workspace: ApplicationsWorkspace) => {
  const appliedFilters = (() => {
    if (workspace.filters.decoded.canonicalValue === undefined) return undefined
    const search = new URLSearchParams()
    search.set('filters', workspace.filters.decoded.canonicalValue)
    return decodeListApplicationsSearchParams(search).filters
  })()
  const requestInput: ApplicationsListRequest = {
    ...(appliedFilters === undefined ? {} : { filters: appliedFilters }),
    ...(workspace.queryState.keyword.trim().length === 0
      ? {}
      : { q: workspace.queryState.keyword.trim() }),
    orderBy: workspace.sorting.flatMap((item) =>
      applicationListQuery.fields.flatMap((field) =>
        field.sortable && field.name === item.id
          ? [
              {
                field: field.name,
                direction: item.desc ? ('desc' as const) : ('asc' as const),
              },
            ]
          : []
      )
    ) as NonNullable<ApplicationsListRequest['orderBy']>,
    size: 50,
    currency: workspace.queryState.currency,
  }
  const requestEnabled =
    workspace.ready &&
    workspace.filters.navigationSettled &&
    !workspace.filters.decoded.needsCanonicalWrite &&
    !workspace.filters.decoded.blocksRequest
  const listAtom = applicationsAtom({
    ...requestInput,
    enabled: requestEnabled,
  })
  const applicationsResult = useAtomValue(listAtom)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [refreshResult, runRefresh] = useAtom(refreshApplicationLists, {
    mode: 'promise',
  })
  const pullApplications = useAtomSet(listAtom, { mode: 'promise' })
  const page = AsyncResult.getOrElse(applicationsResult, () => undefined)
  const applications = requestEnabled ? (page?.items ?? []) : []
  const loading =
    requestEnabled && applicationsResult.waiting && page === undefined
  const refreshPending = AsyncResult.isWaiting(refreshResult)
  const error = workspace.filters.decoded.blocksRequest
    ? 'The filters URL is malformed, duplicated, or invalid. Correct or remove the filters parameter before loading applications.'
    : AsyncResult.matchWithError(applicationsResult, {
        onInitial: () => undefined,
        onError: (reason) =>
          reason instanceof Error
            ? reason.message
            : 'The registry could not be loaded.',
        onDefect: (reason) =>
          reason instanceof Error
            ? reason.message
            : 'The registry could not be loaded.',
        onSuccess: () => undefined,
      })

  const refresh = () => void runRefresh(undefined).catch(() => undefined)
  const loadMore = async () => {
    if (!requestEnabled || applicationsResult.waiting || page?.done !== false)
      return
    setLoadingMore(true)
    try {
      await pullApplications()
    } catch {
      // The list AsyncResult owns error presentation.
    } finally {
      setLoadingMore(false)
    }
  }

  return {
    applications,
    error,
    hasNextPage: page?.done === false,
    loadMore,
    loading,
    loadingMore,
    refresh,
    refreshDisabled:
      !requestEnabled || applicationsResult.waiting || refreshPending,
    refreshing: applicationsResult.waiting || refreshPending,
    tableLoading:
      loading ||
      workspace.isNavigating ||
      (applicationsResult.waiting && page !== undefined && !loadingMore),
  }
}
