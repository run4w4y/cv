import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as React from 'react'

import { asyncResultErrorMessage } from '@/lib/async-result'
import {
  type ApplicationsListRequest,
  applicationsAtom,
  compensationFxRateTableAtom,
  refreshApplicationLists,
} from '../../data'
import type { useApplicationsWorkspace } from './use-workspace'

type ApplicationsWorkspace = ReturnType<typeof useApplicationsWorkspace>

export const useApplicationsList = (workspace: ApplicationsWorkspace) => {
  const requestInput: ApplicationsListRequest = {
    ...workspace.appliedQuery,
    size: 50,
  }
  const requestEnabled =
    workspace.ready && workspace.queryParameterState.status === 'valid'
  const listAtom = applicationsAtom({
    ...requestInput,
    enabled: requestEnabled,
  })
  const applicationsResult = useAtomValue(listAtom)
  const fxRatesResult = useAtomValue(
    compensationFxRateTableAtom(workspace.queryState.currency)
  )
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [refreshResult, runRefresh] = useAtom(refreshApplicationLists, {
    mode: 'promiseExit',
  })
  const pullApplications = useAtomSet(listAtom, { mode: 'promiseExit' })
  const page = AsyncResult.getOrElse(applicationsResult, () => undefined)
  const applications = requestEnabled ? (page?.items ?? []) : []
  const compensationFxRateTable = AsyncResult.getOrElse(
    fxRatesResult,
    () => undefined
  )
  const conversionError =
    workspace.queryState.currency === 'original'
      ? undefined
      : asyncResultErrorMessage(
          fxRatesResult,
          'Compensation conversion rates could not be loaded.'
        )
  const loading =
    requestEnabled && applicationsResult.waiting && page === undefined
  const refreshPending = AsyncResult.isWaiting(refreshResult)
  const error =
    workspace.queryParameterState.status === 'invalid'
      ? 'The query URL is malformed, duplicated, or invalid. Correct or remove the filter and sort parameters before loading applications.'
      : asyncResultErrorMessage(
          applicationsResult,
          'The registry could not be loaded.'
        )

  const refresh = () => void runRefresh(undefined)
  const loadMore = async () => {
    if (!requestEnabled || applicationsResult.waiting || page?.done !== false)
      return
    setLoadingMore(true)
    try {
      await pullApplications()
    } finally {
      setLoadingMore(false)
    }
  }

  return {
    applications,
    compensationFxRateTable: compensationFxRateTable ?? undefined,
    conversionError,
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
      (applicationsResult.waiting && page !== undefined && !loadingMore),
  }
}
